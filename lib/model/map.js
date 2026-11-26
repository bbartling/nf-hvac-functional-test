'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_DIR = path.join(__dirname, '..', '..', 'schema');

/**
 * @param {string} filename
 * @returns {any}
 */
function readMapFile(filename) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8'));
}

/** @returns {any} */
function loadHaystackMap() {
  return readMapFile('haystack-role-map.json');
}

/** @returns {any} */
function loadRdfMap() {
  return readMapFile('rdf-role-map.json');
}

/**
 * Overlay a site map on the shipped map. Entries are keyed by role plus tag
 * or type list, so a site can add a tag set without editing code.
 * @param {any} base
 * @param {any} extra
 */
function mergeMaps(base, extra) {
  if (!extra) return base;
  const roles = new Map();
  for (const entry of base.roles || []) roles.set(entryKey(entry), entry);
  for (const entry of extra.roles || []) roles.set(entryKey(entry), entry);
  return {
    ...base,
    ...extra,
    roles: [...roles.values()],
    version: extra.version || base.version,
  };
}

/**
 * @param {any} entry
 */
function entryKey(entry) {
  if (Array.isArray(entry.tags)) return `${entry.role}|tags:${entry.tags.join(',')}`;
  if (Array.isArray(entry.types)) return `${entry.role}|types:${entry.types.join(',')}`;
  return entry.role;
}

module.exports = {
  loadHaystackMap,
  loadRdfMap,
  mergeMaps,
};
