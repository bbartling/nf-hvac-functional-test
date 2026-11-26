'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {string} root
 */
function stateFile(root) {
  return path.join(root, 'state.json');
}

/**
 * @param {string} root
 */
function readState(root) {
  const file = stateFile(root);
  if (!fs.existsSync(file)) return { pending_start: null, state: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { pending_start: null, state: null };
    return parsed;
  } catch {
    return { pending_start: null, state: null };
  }
}

/**
 * Temp file, fsync, then rename so a crash cannot leave a half-written state.
 * @param {string} root
 * @param {any} state
 */
function writeState(root, state) {
  fs.mkdirSync(root, { recursive: true });
  const file = stateFile(root);
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(state));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

module.exports = { readState, writeState, stateFile };
