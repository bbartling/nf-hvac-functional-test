'use strict';

const { liveWritesAllowed } = require('../config/gates');
const { DryRunWriter } = require('./dry_run');
const { NfCommandWriter } = require('./nf_command');
const { BacnetDirectWriter } = require('./bacnet_direct');

/**
 * @param {{ config: any, confirmLive?: boolean, client: import('../nf/client').NfClient, ledger: import('../ledger').Ledger }} options
 */
function createWriter(options) {
  const { config, ledger } = options;
  if (!liveWritesAllowed(config, options.confirmLive === true)) return new DryRunWriter(ledger);
  if (config.backend === 'bacnet_direct') {
    return new BacnetDirectWriter({
      client: options.client,
      ledger,
      priority: config.bacnet_priority,
    });
  }
  return new NfCommandWriter({
    client: options.client,
    ledger,
    priority: config.bacnet_priority,
    duration_s: config.command_lease_s,
  });
}

module.exports = { createWriter };
