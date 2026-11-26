'use strict';

const { loadRdfMap } = require('./map');

/**
 * @param {string} text
 */
function stripComments(text) {
  return text.split('\n').map((line) => {
    let quote = false;
    let out = '';
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') quote = !quote;
      if (ch === '#' && !quote) break;
      out += ch;
    }
    return out;
  }).join('\n');
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function splitStatements(text) {
  /** @type {string[]} */
  const parts = [];
  let quote = false;
  let angle = false;
  let current = '';
  for (const ch of text) {
    if (ch === '"') quote = !quote;
    else if (ch === '<' && !quote) angle = true;
    else if (ch === '>' && !quote) angle = false;
    if (ch === '.' && !quote && !angle) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * @param {string} token
 * @param {Record<string, string>} prefixes
 */
function expand(token, prefixes) {
  const raw = token.trim().replace(/[;,]+$/g, '');
  if (!raw || raw === 'a') return raw;
  if (raw.startsWith('<') && raw.endsWith('>')) return raw.slice(1, -1);
  if (raw.startsWith('"')) return raw.slice(1, raw.lastIndexOf('"'));
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const prefix = raw.slice(0, colon);
    const local = raw.slice(colon + 1);
    if (prefixes[prefix]) return { iri: prefixes[prefix] + local, local };
    return { iri: raw, local };
  }
  return raw;
}

/**
 * Local name of a subject, predicate, or object token.
 * @param {any} token
 */
function localName(token) {
  if (token && typeof token === 'object') return token.local;
  if (typeof token === 'string' && token.includes('/')) return token.slice(token.lastIndexOf('/') + 1);
  if (typeof token === 'string' && token.includes('#')) return token.slice(token.lastIndexOf('#') + 1);
  return typeof token === 'string' ? token : '';
}

/**
 * @param {string} text
 */
function parseTtl(text) {
  /** @type {Record<string, string>} */
  const prefixes = {};
  /** @type {{ subject: string, predicate: string, object: string }[]} */
  const triples = [];
  for (const statement of splitStatements(stripComments(text))) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@prefix')) {
      const match = trimmed.match(/^@prefix\s+(\w+):\s+<([^>]+)>/);
      if (match) prefixes[match[1]] = match[2];
      continue;
    }
    const chunks = trimmed.split(';').map((part) => part.trim()).filter(Boolean);
    let subject = '';
    chunks.forEach((chunk, index) => {
      const bits = chunk.split(/\s+/).filter(Boolean);
      let predicate;
      let object;
      if (index === 0) {
        subject = localName(expand(bits[0], prefixes));
        predicate = bits[1] === 'a' ? 'a' : localName(expand(bits[1], prefixes));
        object = localName(expand(bits.slice(2).join(' '), prefixes));
      } else {
        predicate = bits[0] === 'a' ? 'a' : localName(expand(bits[0], prefixes));
        object = localName(expand(bits.slice(1).join(' '), prefixes));
      }
      if (subject && predicate && object) triples.push({ subject, predicate, object });
    });
  }
  return { prefixes, triples };
}

/**
 * @param {string} text
 * @param {any} [map]
 */
function loadRdfModel(text, map) {
  const roleMap = map || loadRdfMap();
  const parsed = parseTtl(text);
  /** @type {Map<string, { type: string[], predicates: Record<string, string> }>} */
  const nodes = new Map();
  for (const triple of parsed.triples) {
    if (!nodes.has(triple.subject)) nodes.set(triple.subject, { type: [], predicates: {} });
    const node = nodes.get(triple.subject);
    if (!node) continue;
    if (triple.predicate === 'a') node.type.push(triple.object);
    else node.predicates[triple.predicate] = triple.object;
  }

  /** @type {Record<string, string>} */
  const equipTypes = roleMap.equipment_types || {};
  /** @type {Map<string, string>} */
  const roleByType = new Map();
  for (const entry of roleMap.roles || []) {
    for (const typeName of entry.types || []) roleByType.set(typeName, entry.role);
  }

  /** @type {Map<string, any>} */
  const equipment = new Map();
  /**
   * @param {string} id
   */
  function ensure(id) {
    if (!equipment.has(id)) {
      equipment.set(id, { id, type: null, serves: [], ahuRef: null, points: {}, tags: [] });
    }
    return equipment.get(id);
  }

  for (const [id, node] of nodes) {
    for (const typeName of node.type) {
      if (equipTypes[typeName]) {
        const item = ensure(id);
        item.type = equipTypes[typeName];
      }
    }
  }

  for (const node of nodes.values()) {
    const role = node.type.map((typeName) => roleByType.get(typeName)).find(Boolean);
    if (!role) continue;
    const pointOf = (roleMap.point_of || []).map((name) => node.predicates[name]).find(Boolean);
    if (!pointOf) continue;
    const item = ensure(pointOf);
    const writable = (roleMap.writable_predicates || []).some((name) => node.predicates[name] === 'true');
    const uuid = (roleMap.uuid_predicates || []).map((name) => node.predicates[name]).find(Boolean) || null;
    const layer = (roleMap.layer_predicates || []).map((name) => node.predicates[name]).find(Boolean) || null;
    item.points[role] = { role, uuid, layer, writable, tags: node.type.slice() };
  }

  for (const [id, node] of nodes) {
    for (const name of roleMap.feeds || []) {
      const target = node.predicates[name];
      if (!target) continue;
      const ahu = ensure(target);
      if (!ahu.serves.includes(id)) ahu.serves.push(id);
    }
    for (const name of roleMap.fed_by || []) {
      const target = node.predicates[name];
      if (!target) continue;
      const item = ensure(id);
      item.ahuRef = target;
      const ahu = ensure(target);
      if (!ahu.serves.includes(id)) ahu.serves.push(id);
    }
  }

  return { source: 'rdf', equipment: [...equipment.values()] };
}

module.exports = { loadRdfModel, parseTtl };
