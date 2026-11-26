'use strict';

const { encodeValue, clearSlot } = require('./verify');

class NfCommandWriter {
  /**
   * @param {{ client: import('../nf/client').NfClient, ledger: import('../ledger').Ledger, priority: number, duration_s: number }} options
   */
  constructor(options) {
    this.client = options.client;
    this.ledger = options.ledger;
    this.priority = options.priority;
    this.duration_s = options.duration_s;
    this.backend = 'nf_command';
    /** @type {Map<string, { id: number, name: string }>} */
    this.commands = new Map();
    this.lastCancelError = '';
  }

  /**
   * @param {any} spec
   */
  commandName(spec) {
    return `ftest-${spec.run_id}-${spec.equipment_id}`;
  }

  /**
   * @param {any} spec
   */
  async ensure(spec) {
    const name = this.commandName(spec);
    const existing = this.commands.get(name);
    if (existing) return existing;
    const started = await this.client.startCommand({ name, duration_s: this.duration_s });
    const command = { id: started.id, name };
    this.commands.set(name, command);
    return command;
  }

  /**
   * @param {any} spec
   */
  async write(spec) {
    const name = this.commandName(spec);
    const base = {
      run_id: spec.run_id,
      equipment_id: spec.equipment_id,
      uuid: spec.uuid,
      layer: spec.layer,
      priority: this.priority,
      value: spec.value,
      backend: 'nf_command',
      command_name: name,
    };
    this.ledger.append({ ...base, kind: 'intent' });
    const command = await this.ensure(spec);
    const reply = await this.client.writeInCommand({
      command_id: command.id,
      cancel_on_conflict: true,
      writes: [{
        point: { uuid: spec.uuid, layer: spec.layer },
        priority: this.priority,
        options: { priority: this.priority },
        bacnet_options: { priority: this.priority },
        value: encodeValue(spec.value),
        cancel_on_conflict: true,
      }],
    });
    if (reply.errors && reply.errors.length) {
      this.ledger.append({ ...base, kind: 'failed', sent: true, error: reply.errors[0].error.code });
      return { ok: false, error: reply.errors[0].error.code };
    }
    this.ledger.append({ ...base, kind: 'active', command_id: command.id, sent: true });
    return { ok: true, command_id: command.id };
  }

  /**
   * @param {any} spec
   * @param {string} newExpiration
   */
  async extend(spec, newExpiration) {
    const command = await this.ensure(spec);
    await this.client.extendCommand(command.id, newExpiration);
    return { ok: true, command_id: command.id };
  }

  /**
   * @param {any[]} entries
   */
  async release(entries) {
    /** @type {Map<string, any[]>} */
    const groups = new Map();
    for (const entry of entries) {
      const name = entry.command_name || `ftest-${entry.run_id}-${entry.equipment_id}`;
      const group = groups.get(name) || [];
      group.push(entry);
      groups.set(name, group);
    }
    /** @type {any[]} */
    const verified = [];
    /** @type {any[]} */
    const failed = [];
    for (const [name, group] of groups) {
      await this.cancelNamed(name);
      for (const entry of group) {
        this.ledger.append({
          kind: 'release_intent',
          run_id: entry.run_id,
          equipment_id: entry.equipment_id,
          uuid: entry.uuid,
          layer: entry.layer,
          priority: entry.priority,
          backend: 'nf_command',
          command_name: name,
        });
        if (await clearSlot(this.client, entry)) verified.push(entry);
        else failed.push(entry);
      }
    }
    return { verified, failed };
  }

  /**
   * @param {string} name
   */
  async cancelNamed(name) {
    let command = this.commands.get(name) || null;
    if (!command) {
      const listed = await this.client.listCommands();
      const found = (listed.commands || []).find((item) => item.name === name);
      if (found) command = { id: found.id, name };
    }
    if (!command) return;
    try {
      await this.client.cancelCommand(command.id);
    } catch (error) {
      this.lastCancelError = error instanceof Error ? error.message : String(error);
    }
    this.commands.delete(name);
  }
}

module.exports = { NfCommandWriter };
