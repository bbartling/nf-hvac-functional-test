'use strict';

/**
 * @typedef {'read' | 'write' | 'readwrite'} Direction
 * @typedef {'yes' | 'no' | 'per_strategy' | 'mode_point' | 'bas_toggle' | 'recommended'} Requirement
 * @typedef {'ahu' | 'vav'} EquipmentType
 * @typedef {{ min: number, max: number }} NumericClamp
 * @typedef {object} RoleDef
 * @property {string} id
 * @property {EquipmentType} equipment
 * @property {Direction} direction
 * @property {string} unit
 * @property {Requirement} requirement
 * @property {boolean} ftest
 * @property {NumericClamp | null} clamp
 */

/** @type {RoleDef[]} */
const ROLE_LIST = [
  { id: 'discharge_air_temperature', equipment: 'ahu', direction: 'read', unit: 'degC', requirement: 'yes', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'mixed_air_temperature', equipment: 'ahu', direction: 'read', unit: 'degC', requirement: 'yes', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'return_air_temperature', equipment: 'ahu', direction: 'read', unit: 'degC', requirement: 'yes', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'outside_air_temperature', equipment: 'ahu', direction: 'read', unit: 'degC', requirement: 'yes', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'outside_air_relative_humidity', equipment: 'ahu', direction: 'read', unit: '%', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'discharge_air_temperature_setpoint', equipment: 'ahu', direction: 'read', unit: 'degC', requirement: 'no', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'duct_static_pressure', equipment: 'ahu', direction: 'read', unit: 'Pa', requirement: 'yes', ftest: false, clamp: { min: -500, max: 5000 } },
  { id: 'duct_static_pressure_setpoint', equipment: 'ahu', direction: 'read', unit: 'Pa', requirement: 'no', ftest: false, clamp: { min: -500, max: 5000 } },
  { id: 'supply_fan_run_status', equipment: 'ahu', direction: 'read', unit: 'bool', requirement: 'yes', ftest: false, clamp: null },
  { id: 'supply_fan_command', equipment: 'ahu', direction: 'read', unit: 'bool_or_percent', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'outside_air_damper_position', equipment: 'ahu', direction: 'read', unit: '%', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'return_air_damper_position', equipment: 'ahu', direction: 'read', unit: '%', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'cooling_valve_position', equipment: 'ahu', direction: 'read', unit: '%', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'heating_valve_position', equipment: 'ahu', direction: 'read', unit: '%', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'outside_air_damper_command', equipment: 'ahu', direction: 'write', unit: '%', requirement: 'per_strategy', ftest: true, clamp: { min: 0, max: 100 } },
  { id: 'return_air_damper_command', equipment: 'ahu', direction: 'write', unit: '%', requirement: 'no', ftest: true, clamp: { min: 0, max: 100 } },
  { id: 'cooling_valve_command', equipment: 'ahu', direction: 'write', unit: '%', requirement: 'per_strategy', ftest: true, clamp: { min: 0, max: 100 } },
  { id: 'heating_valve_command', equipment: 'ahu', direction: 'write', unit: '%', requirement: 'per_strategy', ftest: true, clamp: { min: 0, max: 100 } },
  { id: 'ahu_test_mode_command', equipment: 'ahu', direction: 'write', unit: 'enum', requirement: 'mode_point', ftest: true, clamp: null },
  { id: 'freeze_protection_status', equipment: 'ahu', direction: 'read', unit: 'bool', requirement: 'recommended', ftest: true, clamp: null },
  { id: 'smoke_alarm_status', equipment: 'ahu', direction: 'read', unit: 'bool', requirement: 'recommended', ftest: true, clamp: null },
  { id: 'vav_max_cooling_mode_command', equipment: 'ahu', direction: 'write', unit: 'bool_or_enum', requirement: 'bas_toggle', ftest: true, clamp: null },
  { id: 'discharge_air_flow', equipment: 'vav', direction: 'read', unit: 'm3/s', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'cooling_air_flow_setpoint', equipment: 'vav', direction: 'readwrite', unit: 'm3/s', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'cooling_air_flow_maximum', equipment: 'vav', direction: 'read', unit: 'm3/s', requirement: 'no', ftest: true, clamp: { min: 0, max: 100 } },
  { id: 'discharge_air_damper_position', equipment: 'vav', direction: 'read', unit: '%', requirement: 'no', ftest: false, clamp: { min: 0, max: 100 } },
  { id: 'zone_air_temperature', equipment: 'vav', direction: 'read', unit: 'degC', requirement: 'no', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'zone_air_temperature_setpoint', equipment: 'vav', direction: 'read', unit: 'degC', requirement: 'no', ftest: false, clamp: { min: -50, max: 80 } },
  { id: 'flush_mode_command', equipment: 'vav', direction: 'write', unit: 'bool_or_enum', requirement: 'no', ftest: true, clamp: null },
];

/** @type {ReadonlyMap<string, RoleDef>} */
const BY_ID = new Map(ROLE_LIST.map((role) => [role.id, Object.freeze(role)]));

/**
 * @param {string} id
 * @returns {RoleDef | undefined}
 */
function getRole(id) {
  return BY_ID.get(id);
}

/** @returns {RoleDef[]} */
function listRoles() {
  return ROLE_LIST.map((role) => role);
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function isKnownRole(id) {
  return BY_ID.has(id);
}

/**
 * @param {RoleDef} role
 * @returns {boolean}
 */
function roleAllowsWrite(role) {
  return role.direction === 'write' || role.direction === 'readwrite';
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isBoolish(value) {
  return typeof value === 'boolean' || value === 0 || value === 1;
}

/**
 * @param {RoleDef} role
 * @param {unknown} value
 * @param {{ airflowMax?: number | null, enumValues?: unknown[] }} [limits]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function valueInClamp(role, value, limits) {
  const cap = limits || {};
  if (role.unit === 'bool') {
    return isBoolish(value) ? { ok: true } : { ok: false, reason: 'clamp' };
  }
  if (role.unit === 'enum') {
    if (!Array.isArray(cap.enumValues) || !cap.enumValues.some((item) => item === value)) {
      return { ok: false, reason: 'enum' };
    }
    return { ok: true };
  }
  if (role.unit === 'bool_or_enum') {
    if (isBoolish(value)) return { ok: true };
    if (Array.isArray(cap.enumValues) && cap.enumValues.some((item) => item === value)) return { ok: true };
    return { ok: false, reason: 'enum' };
  }
  if (role.unit === 'bool_or_percent' && isBoolish(value)) return { ok: true };
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, reason: 'clamp' };
  }
  const clamp = role.clamp;
  if (!clamp) return { ok: false, reason: 'clamp' };
  let max = clamp.max;
  if (role.unit === 'm3/s' && typeof cap.airflowMax === 'number') {
    max = Math.min(max, cap.airflowMax);
  }
  if (value < clamp.min || value > max) return { ok: false, reason: 'clamp' };
  return { ok: true };
}

module.exports = {
  getRole,
  listRoles,
  isKnownRole,
  roleAllowsWrite,
  valueInClamp,
};
