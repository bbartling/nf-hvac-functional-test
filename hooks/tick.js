'use strict';

const { tick, bindRelease, createSession } = require('../lib/admin');

/** @type {any} */
let session = createSession();
let signalsBound = false;

/**
 * NF calls this with the applications SDK. The SDK is not required at load time.
 * @param {any} sdk
 */
async function onTick(sdk) {
  if (!signalsBound) {
    bindRelease(sdk, () => {
      if (session.runner && typeof session.runner.abort === 'function') {
        session.runner.abort();
      }
    });
    signalsBound = true;
  }
  return tick(sdk, session);
}

onTick.useSession = (next) => {
  session = next;
};

module.exports = onTick;
