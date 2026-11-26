'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { createFake } = require('./fake/server');
const { NfClient } = require('../lib/nf/client');
const { adminAction, createSession, tick, bindRelease } = require('../lib/admin');
const onTick = require('../hooks/tick');
const onRequest = require('../hooks/admin');

function stubRunner() {
  const runner = {
    state: { phase: 'IDLE', stepIndex: -1, runId: '', needsAttention: false },
    manifest: { overrides: [], dry_run: true },
    attention: 0,
    vavReport: [],
    async start(id) {
      this.state.phase = 'BASELINE';
      this.state.runId = id;
      this.state.stepIndex = 0;
    },
    async abort() {
      this.state.phase = 'ABORTED';
    },
    async retryRelease() {
      this.state.phase = 'RELEASING';
    },
    async acknowledge() {
      this.state.needsAttention = false;
      this.state.phase = 'IDLE';
    },
  };
  return runner;
}

test('admin actions validate, discover, start, abort, and acknowledge', async () => {
  const fake = await createFake();
  try {
    fake.seedAhu({ points: { outside_air_temperature: '00000000-0000-4000-8000-000000000301' } });
    const client = new NfClient({ baseUrl: fake.baseUrl, sleep: async () => {} });
    let writes = 0;
    const original = client.writeInCommand.bind(client);
    client.writeInCommand = async (body) => {
      writes += 1;
      return original(body);
    };
    const session = createSession();
    session.client = client;
    session.factory = async (args) => {
      if (args.confirm_live !== true && args.live === true) return null;
      return stubRunner();
    };
    const example = JSON.parse(fs.readFileSync('examples/site-config.example.json', 'utf8'));
    const valid = await adminAction(session, 'config', { op: 'validate', config: example });
    assert.equal(valid.ok, true);
    const bad = await adminAction(session, 'config', { op: 'validate', config: { version: 1, write: { bacnet_priority: 1 } } });
    assert.equal(bad.ok, false);
    const found = await adminAction(session, 'config', { op: 'discover' });
    assert.equal(found.writes, 0);
    assert.ok(found.count >= 1);
    assert.equal(writes, 0);
    const refused = await adminAction(session, 'start', { live: true, confirm_live: false, run_id: 'run_no' });
    assert.equal(refused.code, 'confirm_live');
    assert.equal(writes, 0);
    const started = await adminAction(session, 'start', { confirm_live: true, run_id: 'run_operator' });
    assert.equal(started.state, 'BASELINE');
    const view = await adminAction(session, 'status');
    assert.equal(view.run_id, 'run_operator');
    assert.ok(session.runner);
    session.runner.state.needsAttention = true;
    const released = await adminAction(session, 'retry_release');
    assert.equal(released.state, 'RELEASING');
    const acked = await adminAction(session, 'acknowledge');
    assert.equal(acked.state, 'IDLE');
    const aborted = await adminAction(session, 'abort');
    assert.equal(aborted.state, 'ABORTED');
    assert.equal((await adminAction(session, 'nope')).code, 'unknown_action');

    const sdk = {
      options: { enabled: true },
      globals: {},
      signals: {},
      setGlobal(name, value) { this.globals[name] = value; },
      onSignal(signal, fn) { this.signals[signal] = fn; },
    };
    onTick.useSession(session);
    onRequest.useSession(session);
    const globals = await onTick(sdk);
    assert.equal(globals.ftest_state, 'ABORTED');
    assert.equal(sdk.globals.ftest_needs_attention, 0);
    sdk.signals.SIGTERM();
    const hooked = await onRequest({
      args: { action: 'status', payload: '{}' },
    });
    assert.equal(hooked.state, 'ABORTED');
    sdk.options.enabled = false;
    const skipped = await tick(sdk, session);
    assert.equal(skipped.skipped, true);
    let releasedOnSignal = 0;
    bindRelease({ onSignal(_s, fn) { fn(); } }, () => { releasedOnSignal += 1; });
    assert.equal(releasedOnSignal, 1);
  } finally {
    await fake.close();
  }
});

test('the status page lists the operator fields and serves', async () => {
  const html = fs.readFileSync('static/index.html', 'utf8');
  for (const id of ['state', 'step', 'time-left', 'overrides', 'interlocks', 'release', 'capability', 'abort', 'dry-run-banner']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
  });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const reply = await fetch(`http://127.0.0.1:${port}/`);
    const body = await reply.text();
    assert.equal(reply.status, 200);
    assert.match(body, /Dry-run is on/);
    assert.match(body, /Abort/);
  } finally {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
});
