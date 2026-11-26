'use strict';

const { validateSiteConfig } = require('./config');

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
    if (!session.factory) return { ok: false, code: 'no_runner' };
    const runner = await session.factory(args);
    if (!runner) return { ok: false, code: 'confirm_live', writes: 0 };
    session.runner = runner;
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
  const view = status(session || { runner: null });
  const values = {
    ftest_state: view.state,
    ftest_step_index: view.step_index,
    ftest_run_seq: view.run_id,
    ftest_overrides_active: view.overrides,
    ftest_needs_attention: view.needs_attention ? 1 : 0,
  };
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
