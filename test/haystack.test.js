'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadHaystackModel, pointTags, matchRoleResult } = require('../lib/model/haystack');
const { loadHaystackMap, mergeMaps } = require('../lib/model/map');

const MAP = loadHaystackMap();

/**
 * @param {string[]} tags
 * @param {Record<string, string>} [attrs]
 */
function tagged(tags, attrs = {}) {
  /** @type {Record<string, string>} */
  const record = { equipRef: 'ahu_a', ...attrs };
  for (const tag of tags) record[tag] = 'm:';
  return {
    uuid: '00000000-0000-4000-8000-000000000201',
    layer: 'hpl:bacnet:1',
    attrs: record,
  };
}

/**
 * @param {any} point
 */
function roleOf(point) {
  const model = loadHaystackModel({
    equipment: [{ id: 'ahu_a', type: 'ahu' }],
    points: [point],
  });
  const points = model.equipment.find((item) => item.id === 'ahu_a').points;
  return { points, ambiguous: model.ambiguous };
}

test('cmd forces a command role and a tie is reported instead of guessed', () => {
  const fan = roleOf(tagged(['supply', 'fan', 'run', 'cmd']));
  assert.equal(fan.points.supply_fan_command.role, 'supply_fan_command');
  assert.equal(fan.points.supply_fan_run_status, undefined);
  assert.equal(fan.ambiguous.length, 0);

  const tiedMap = mergeMaps(MAP, {
    version: 1,
    roles: [{ role: 'ahu_test_mode_command', tags: ['fan', 'cmd', 'run'] }],
  });
  const tags = pointTags(tagged(['supply', 'fan', 'run', 'cmd']));
  const tied = matchRoleResult(tags, tiedMap);
  assert.equal(tied.entry, null);
  assert.equal(tied.ambiguous, true);
  assert.deepEqual(tied.roles.slice().sort(), ['ahu_test_mode_command', 'supply_fan_command']);

  const loaded = loadHaystackModel({
    equipment: [{ id: 'ahu_a', type: 'ahu' }],
    points: [tagged(['supply', 'fan', 'run', 'cmd'])],
  }, tiedMap);
  assert.equal(loaded.equipment[0].points.supply_fan_command, undefined);
  assert.equal(loaded.equipment[0].points.ahu_test_mode_command, undefined);
  assert.equal(loaded.ambiguous.length, 1);
  assert.deepEqual(loaded.ambiguous[0].roles, ['ahu_test_mode_command', 'supply_fan_command']);
});

test('max or min airflow cannot bind to the writable setpoint', () => {
  const capped = roleOf(tagged(['max', 'air', 'flow', 'sp', 'writable']));
  assert.equal(capped.points.cooling_air_flow_setpoint, undefined);
  assert.equal(capped.points.cooling_air_flow_maximum, undefined);

  const minimum = roleOf(tagged(['min', 'air', 'flow', 'sp', 'writable']));
  assert.equal(minimum.points.cooling_air_flow_setpoint, undefined);

  const setpoint = roleOf(tagged(['air', 'flow', 'sp', 'writable']));
  assert.equal(setpoint.points.cooling_air_flow_setpoint.writable, true);
  const maximum = roleOf(tagged(['air', 'flow', 'max']));
  assert.equal(maximum.points.cooling_air_flow_maximum.writable, false);
});

test('class and comma-separated markers are tags, including Haystack 4 names', () => {
  const fromMarkers = roleOf({
    uuid: '00000000-0000-4000-8000-000000000202',
    layer: 'hpl:bacnet:1',
    attrs: {
      class: 'point',
      markers: 'cool, valve, cmd, writable',
      equipRef: 'ahu_a',
    },
  });
  assert.equal(fromMarkers.points.cooling_valve_command.writable, true);

  const fromClass = roleOf({
    uuid: '00000000-0000-4000-8000-000000000203',
    layer: 'hpl:bacnet:1',
    attrs: {
      class: 'freezeStat',
      markers: '',
      equipRef: 'ahu_a',
    },
  });
  assert.equal(fromClass.points.freeze_protection_status.role, 'freeze_protection_status');

  const duct = roleOf({
    uuid: '00000000-0000-4000-8000-000000000204',
    layer: 'hpl:bacnet:1',
    attrs: {
      class: 'sensor',
      markers: 'ductStatic,sensor',
      equipRef: 'ahu_a',
    },
  });
  assert.equal(duct.points.duct_static_pressure.role, 'duct_static_pressure');

  const damper = roleOf(tagged(['outside', 'damper', 'cmd', 'writable']));
  assert.equal(damper.points.outside_air_damper_command.role, 'outside_air_damper_command');
  const withAir = roleOf(tagged(['outside', 'air', 'damper', 'cmd', 'writable']));
  assert.equal(withAir.points.outside_air_damper_command.role, 'outside_air_damper_command');
});
