'use strict';

const path = require('node:path');
const { validateSiteConfig } = require('./config');
const { readState, writeState } = require('./persist');

const ACTIVE = new Set(['PRECHECK', 'BASELINE', 'STEP', 'RECOVERY', 'RELEASING', 'NEEDS_ATTENTION']);

const GLOBALS = [
  'ftest_state',
  'ftest_step_index',
  'ftest_run_seq',
  'ftest_overrides_active',
  'ftest_needs_attention',
];

function createSession() {
  return {
    runner: /** @type {any} */ (null),
    factory: /** @type {any} */ (null),
    client: /** @type {any} */ (null),
    configText: '',
    last: /** @type {any} */ (null),
  };
}

/**
 * @param {any} session
 */
function status(session) {
  const runner = session.runner;
  const state = runner ? runner.state : { phase: 'IDLE', stepIndex: -1, runId: '', needsAttention: false };
  const overrides = runner && runner.manifest ? runner.manifest.overrides.length : 0;
  return {
    ok: true,
    state: state.phase,
    step_index: state.stepIndex,
    run_id: state.runId || '',
    overrides,
    needs_attention: Boolean(state.needsAttention || (runner && runner.attention)),
    dry_run: runner ? runner.manifest.dry_run !== false : true,
    capability: runner && runner.vavReport ? runner.vavReport : [],
  };
}

/**
 * @param {any} session
 * @param {string} action
 * @param {any} args
 */
async function adminAction(session, action, args = {}) {
  if (action === 'config' && args.op === 'validate') {
    let parsed = args.config;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed || '{}');
    const result = validateSiteConfig(parsed || {});
    return { ok: result.ok, errors: result.errors || [] };
  }
  if (action === 'config' && args.op === 'discover') {
    if (!session.client) return { ok: false, code: 'no_client' };
    const reply = await session.client.queryPoints(args.query || {});
    return { ok: true, count: (reply.points || []).length, writes: 0 };
  }
  if (action === 'start') {
    if (args.live === true && args.confirm_live !== true) return { ok: false, code: 'confirm_live', writes: 0 };
    if (session.root) {
      const saved = readState(session.root);
      const phase = saved.state && saved.state.phase;
      if (ACTIVE.has(phase) || saved.pending_start) return { ok: false, code: 'run_active' };
      saved.pending_start = {
        run_id: args.run_id || 'run_operator',
        confirm_live: args.confirm_live === true,
        live: args.live === true,
      };
      writeState(session.root, saved);
      session.last = { ok: true, state: 'IDLE', pending: true, writes: 0 };
      return session.last;
    }
    if (!session.factory) return { ok: false, code: 'no_runner' };
    const runner = await session.factory(args);
    if (!runner) return { ok: false, code: 'confirm_live', writes: 0 };
    session.runner = runner;
    attachRunFiles(session, runner);
    await runner.start(args.run_id || 'run_operator');
    session.last = status(session);
    return session.last;
  }
  if (action === 'abort') {
    if (session.runner) await session.runner.abort();
    session.last = status(session);
    return session.last;
  }
  if (action === 'status') return status(session);
  if (action === 'retry_release') {
    if (session.runner) await session.runner.retryRelease();
    session.last = status(session);
    return session.last;
  }
  if (action === 'acknowledge') {
    if (session.runner) {
      session.runner.attention = 0;
      await session.runner.acknowledge();
    }
    session.last = status(session);
    return session.last;
  }
  return { ok: false, code: 'unknown_action' };
}

/**
 * @param {any} sdk
 * @param {any} session
 */
async function tick(sdk, session) {
  const enabled = sdk.options ? sdk.options.enabled : true;
  if (enabled === false) return { skipped: true };
  if (session && session.root) await drive(session);
  const view = status(session || { runner: null });
  const values = {
    ftest_state: view.state,
    ftest_step_index: view.step_index,
    ftest_run_seq: view.run_id,
    ftest_overrides_active: view.overrides,
    ftest_needs_attention: view.needs_attention ? 1 : 0,
  };
  const variables = Array.isArray(sdk.globalVariables) ? sdk.globalVariables : [];
  for (const variable of variables) {
    if (variable && Object.prototype.hasOwnProperty.call(values, variable.label)) variable.value = values[variable.label];
  }
  for (const name of GLOBALS) {
    if (typeof sdk.setGlobal === 'function') sdk.setGlobal(name, values[name]);
  }
  return values;
}

/**
 * Best-effort release used by the tick hook on SIGTERM. Tests pass the registrar.
 * @param {{ onSignal?: (signal: string, fn: () => void) => void }} sdk
 * @param {() => void} release
 */
/**
 * Load the shared state file, resume or start, tick once, and write the file back.
 * @param {any} session
 */
async function drive(session) {
  const saved = readState(session.root);
  if (!session.runner && saved.pending_start && session.factory) {
    const runner = await session.factory(saved.pending_start);
    if (!runner) {
      writeState(session.root, { ...saved, pending_start: null, last_error: 'confirm_live' });
      return;
    }
    runner.paced = true;
    session.runner = runner;
    attachRunFiles(session, runner);
    await releaseForeign(runner, saved.pending_start.run_id);
    await runner.start(saved.pending_start.run_id || 'run_operator');
  } else if (!session.runner && saved.state && ACTIVE.has(saved.state.phase) && session.factory) {
    const runner = await session.factory(saved);
    if (runner) {
      runner.paced = true;
      session.runner = runner;
      runner.state = { ...runner.state, ...saved.state };
      await releaseForeign(runner, saved.state.runId);
    }
  }
  if (session.runner && typeof session.runner.tick === 'function' && ACTIVE.has(session.runner.state.phase)) {
    await session.runner.tick();
  }
  writeState(session.root, {
    pending_start: null,
    state: session.runner ? session.runner.state : (saved.state || { phase: 'IDLE' }),
    dry_run: session.runner ? session.runner.manifest.dry_run !== false : true,
    confirm_live: Boolean((saved.pending_start && saved.pending_start.confirm_live) || saved.confirm_live),
  });
}

/**
 * Release ledger rows that belong to an older run. The active run stays held.
 * @param {any} runner
 * @param {string} runId
 */
async function releaseForeign(runner, runId) {
  if (!runner.ledger || typeof runner.recover !== 'function') return;
  const foreign = runner.ledger.openOverrides().filter((entry) => entry.run_id !== runId);
  if (!foreign.length && !runner.ledger.openPeriods().length) return;
  if (typeof runner.recoverForeign === 'function') await runner.recoverForeign(runId);
}

/**
 * Shadow samples and the run manifest live under the install directory.
 * @param {any} session
 * @param {any} runner
 */
function attachRunFiles(session, runner) {
  if (!session.root) return;
  runner.seqDir = path.join(session.root, 'local');
  runner.manifestDir = path.join(session.root, 'local', 'runs');
}

function bindRelease(sdk, release) {
  if (typeof sdk.onSignal !== 'function') return;
  sdk.onSignal('SIGTERM', () => {
    try {
      release();
    } catch {
      // shutdown must not throw
    }
  });
}

module.exports = {
  GLOBALS,
  createSession,
  adminAction,
  status,
  tick,
  bindRelease,
};
