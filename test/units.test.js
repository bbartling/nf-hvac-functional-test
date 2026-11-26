'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { convertToSi } = require('../lib/units');

test('converts common unit tokens to SI', () => {
  const temp = convertToSi(32, 'degF', 'degC');
  assert.equal(temp.ok, true);
  if (temp.ok) assert.ok(Math.abs(temp.value) < 1e-9);
  const flow = convertToSi(1000, 'cfm', 'm3/s');
  assert.equal(flow.ok, true);
  if (flow.ok) assert.ok(Math.abs(flow.value - 0.4719474432) < 1e-9);
  const pressure = convertToSi(1, 'inH2O', 'Pa');
  assert.equal(pressure.ok, true);
  if (pressure.ok) assert.ok(pressure.value > 249 && pressure.value < 250);
  assert.deepEqual(convertToSi(21.5, 'degC', 'degC'), { ok: true, value: 21.5, unit: 'degC' });
  assert.deepEqual(convertToSi(10, 'L/s', 'm3/s'), { ok: true, value: 0.01, unit: 'm3/s' });
});

test('unknown or mismatched units fail closed', () => {
  assert.deepEqual(convertToSi(1, 'furlong', 'm3/s'), { ok: false, reason: 'unknown_unit' });
  assert.deepEqual(convertToSi(1, 'degF', 'Pa'), { ok: false, reason: 'unit_mismatch' });
  assert.deepEqual(convertToSi('12', 'degC', 'degC'), { ok: false, reason: 'not_a_number' });
  assert.deepEqual(convertToSi(Number.NaN, 'Pa', 'Pa'), { ok: false, reason: 'not_a_number' });
});
