'use strict';

const { adminAction, createSession } = require('../lib/admin');
const { ensureRuntime } = require('../lib/runtime');

/** @type {any} */
let session = createSession();

/**
 * Operator actions. Arguments arrive as strings.
 * @param {any} ctx
 */
async function onRequest(ctx) {
  const sdk = ctx && ctx.sdk ? ctx.sdk : (ctx || {});
  ensureRuntime(session, sdk);
  const args = (ctx && ctx.args) || sdk.args || {};
  const action = String(args.action || '');
  let payload = {};
  if (typeof args.payload === 'string' && args.payload) payload = JSON.parse(args.payload);
  else if (args.payload && typeof args.payload === 'object') payload = args.payload;
  if (args.op) payload.op = args.op;
  if (args.config) payload.config = args.config;
  return adminAction(session, action, payload);
}

onRequest.useSession = (next) => {
  session = next;
};

module.exports = onRequest;
