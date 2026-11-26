'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getRole, listRoles, isKnownRole, roleAllowsWrite, valueInClamp } = require('../lib/roles');

/**
 * @param {string} id
 */
function must(id) {
  const role = getRole(id);
  if (!role) throw new Error(`missing role ${id}`);
  return role;
}

test('registry covers the design role tables', () => {
  const roles = listRoles();
  assert.equal(roles.length, 29);
  const ids = new Set(roles.map((role) => role.id));
  assert.equal(ids.size, roles.length);
  for (const role of roles) {
    assert.equal(getRole(role.id), role);
    assert.equal(isKnownRole(role.id), true);
    assert.ok(['read', 'write', 'readwrite'].includes(role.direction));
    assert.ok(['ahu', 'vav'].includes(role.equipment));
    assert.ok(role.unit.length > 0);
  }
  assert.equal(isKnownRole('supply_fan_speed'), false);
});

test('write direction matches the allow-list rule', () => {
  assert.equal(roleAllowsWrite(must('outside_air_damper_command')), true);
  assert.equal(roleAllowsWrite(must('cooling_air_flow_setpoint')), true);
  assert.equal(roleAllowsWrite(must('supply_fan_command')), false);
  assert.equal(roleAllowsWrite(must('supply_fan_run_status')), false);
});

test('proposed roles are marked ftest', () => {
  const proposed = [
    'outside_air_damper_command',
    'return_air_damper_command',
    'cooling_valve_command',
    'heating_valve_command',
    'ahu_test_mode_command',
    'freeze_protection_status',
    'smoke_alarm_status',
    'vav_max_cooling_mode_command',
    'cooling_air_flow_maximum',
    'flush_mode_command',
  ];
  for (const id of proposed) assert.equal(must(id).ftest, true);
  assert.equal(must('discharge_air_temperature').ftest, false);
});

test('percent clamps are 0 to 100', () => {
  const role = must('outside_air_damper_command');
  assert.deepEqual(valueInClamp(role, 0), { ok: true });
  assert.deepEqual(valueInClamp(role, 100), { ok: true });
  assert.equal(valueInClamp(role, -0.1).ok, false);
  assert.equal(valueInClamp(role, 100.1).ok, false);
  assert.equal(valueInClamp(role, '100').ok, false);
});

test('airflow clamp respects the caller cap', () => {
  const role = must('cooling_air_flow_setpoint');
  assert.equal(valueInClamp(role, 0.2).ok, true);
  assert.equal(valueInClamp(role, 0.2, { airflowMax: 0.1 }).ok, false);
  assert.equal(valueInClamp(role, 0.05, { airflowMax: 0.1 }).ok, true);
  assert.equal(valueInClamp(role, -1).ok, false);
});

test('enum and bool clamps', () => {
  const mode = must('ahu_test_mode_command');
  assert.equal(valueInClamp(mode, 2, { enumValues: [1, 2] }).ok, true);
  assert.equal(valueInClamp(mode, 3, { enumValues: [1, 2] }).ok, false);
  const fan = must('supply_fan_run_status');
  assert.equal(valueInClamp(fan, true).ok, true);
  assert.equal(valueInClamp(fan, 0).ok, true);
  assert.equal(valueInClamp(fan, 2).ok, false);
  const toggle = must('vav_max_cooling_mode_command');
  assert.equal(valueInClamp(toggle, true).ok, true);
  assert.equal(valueInClamp(toggle, 4, { enumValues: [4] }).ok, true);
  assert.equal(valueInClamp(toggle, 9).ok, false);
  const missed = valueInClamp(toggle, 9, { enumValues: [4] });
  assert.equal(missed.ok, false);
  if (!missed.ok) assert.equal(missed.reason, 'enum');
  const command = must('supply_fan_command');
  assert.equal(valueInClamp(command, false).ok, true);
  assert.equal(valueInClamp(command, 40).ok, true);
});
