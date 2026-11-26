'use strict';

/**
 * @param {import('../nf/client').NfClient} client
 * @param {{ uuid: string, priority: number }} entry
 * @returns {Promise<'empty' | 'held' | 'unreadable'>}
 */
async function readSlot(client, entry) {
  const reply = await client.bacnetRead([{ uuid: entry.uuid, property: 'PRIORITY_ARRAY' }]);
  if (!reply || (reply.errors && reply.errors.length)) return 'unreadable';
  const slots = reply.results && reply.results[0] ? reply.results[0].value : null;
  if (!Array.isArray(slots)) return 'empty';
  const value = slots[entry.priority - 1];
  if (value === null || value === undefined) return 'empty';
  return 'held';
}

/**
 * @param {number | boolean | string | null} value
 */
function encodeValue(value) {
  if (value === null) return { null: 0 };
  if (typeof value === 'boolean') return { boolean: value };
  if (typeof value === 'number') return { real: value };
  return { enum: value };
}

/**
 * @param {import('../nf/client').NfClient} client
 * @param {{ uuid: string, priority: number }} entry
 */
async function clearSlot(client, entry) {
  const before = await readSlot(client, entry);
  if (before === 'empty') return true;
  const reply = await client.bacnetWrite({
    uuid: entry.uuid,
    priority: entry.priority,
    value: null,
  });
  if (reply.errors && reply.errors.length) return false;
  return (await readSlot(client, entry)) === 'empty';
}

module.exports = { readSlot, encodeValue, clearSlot };
