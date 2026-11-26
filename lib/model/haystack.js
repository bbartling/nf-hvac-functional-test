'use strict';

const { getRole } = require('../roles');
const { loadHaystackMap } = require('./map');

const MARKER_VALUES = new Set(['m:', 'M', 'marker', true]);

/**
 * @param {any} point
 * @returns {Set<string>}
 */
function pointTags(point) {
  const tags = new Set();
  if (Array.isArray(point.tags)) {
    for (const tag of point.tags) tags.add(String(tag).toLowerCase());
  }
  const attrs = point.attrs && typeof point.attrs === 'object' ? point.attrs : {};
  for (const [key, value] of Object.entries(attrs)) {
    if (MARKER_VALUES.has(value)) tags.add(key.toLowerCase());
  }
  return tags;
}

/**
 * @param {Set<string>} tags
 * @param {any} map
 */
function matchRole(tags, map) {
  let best = null;
  let bestScore = -1;
  for (const entry of map.roles) {
    if (!entry.tags.every((tag) => tags.has(tag))) continue;
    if (Array.isArray(entry.forbid) && entry.forbid.some((tag) => tags.has(tag))) continue;
    if (entry.tags.length > bestScore) {
      best = entry;
      bestScore = entry.tags.length;
    }
  }
  return best;
}

/**
 * @param {Set<string>} tags
 * @param {any} map
 * @returns {'ahu' | 'vav' | null}
 */
function typeFromTags(tags, map) {
  const table = map.equipment_tags || {};
  for (const kind of ['ahu', 'vav']) {
    const markers = table[kind] || [];
    if (markers.some((tag) => tags.has(String(tag).toLowerCase()))) return /** @type {'ahu' | 'vav'} */ (kind);
  }
  return null;
}

/**
 * @param {any[]} points
 * @returns {'ahu' | 'vav' | null}
 */
function typeFromRoles(points) {
  for (const point of points) {
    const role = getRole(point.role);
    if (role) return role.equipment;
  }
  return null;
}

/**
 * @param {any} input
 * @param {any} [map]
 */
function loadHaystackModel(input, map) {
  const roleMap = map || loadHaystackMap();
  const markers = new Set((roleMap.writable_markers || ['writable']).map((tag) => String(tag).toLowerCase()));
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

  for (const record of input.equipment || []) {
    const item = ensure(String(record.id));
    const tags = pointTags(record);
    item.tags = [...tags];
    item.type = record.type || typeFromTags(tags, roleMap);
    if (typeof record.ahuRef === 'string') item.ahuRef = record.ahuRef;
    if (Array.isArray(record.serves)) item.serves = record.serves.map(String);
  }

  for (const point of input.points || []) {
    const tags = pointTags(point);
    const equipId = point.equipRef || point.equip_id || (point.attrs && point.attrs.equipRef);
    if (!equipId) continue;
    const item = ensure(String(equipId));
    const matched = matchRole(tags, roleMap);
    if (!matched) continue;
    item.points[matched.role] = {
      role: matched.role,
      uuid: point.uuid || (point.attrs && point.attrs.uuid) || null,
      layer: point.layer || (point.attrs && point.attrs.layer) || null,
      writable: [...markers].some((marker) => tags.has(marker)),
      tags: [...tags],
    };
    const ahuRef = point.ahuRef || (point.attrs && typeof point.attrs.ahuRef === 'string' ? point.attrs.ahuRef : null);
    if (typeof ahuRef === 'string') item.ahuRef = ahuRef;
  }

  for (const item of equipment.values()) {
    if (!item.type) item.type = typeFromRoles(Object.values(item.points));
    if (item.ahuRef) {
      const ahu = ensure(item.ahuRef);
      if (!ahu.serves.includes(item.id)) ahu.serves.push(item.id);
    }
  }

  return { source: 'haystack', equipment: [...equipment.values()] };
}

module.exports = { loadHaystackModel, pointTags, matchRole };
