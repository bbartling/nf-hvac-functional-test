'use strict';

/** @type {Record<string, { si: string, toSi: (value: number) => number }>} */
const CONVERSIONS = {
  degC: { si: 'degC', toSi: (value) => value },
  degF: { si: 'degC', toSi: (value) => ((value - 32) * 5) / 9 },
  K: { si: 'degC', toSi: (value) => value - 273.15 },
  Pa: { si: 'Pa', toSi: (value) => value },
  inH2O: { si: 'Pa', toSi: (value) => value * 249.088908333 },
  psi: { si: 'Pa', toSi: (value) => value * 6894.757293168 },
  '%': { si: '%', toSi: (value) => value },
  'm3/s': { si: 'm3/s', toSi: (value) => value },
  cfm: { si: 'm3/s', toSi: (value) => value * 0.0004719474432 },
  'L/s': { si: 'm3/s', toSi: (value) => value * 0.001 },
};

/**
 * Convert a numeric reading into the SI unit used by thresholds.
 * Unknown or mismatched units fail closed.
 * @param {unknown} value
 * @param {string} fromUnit
 * @param {string} targetUnit
 * @returns {{ ok: true, value: number, unit: string } | { ok: false, reason: string }}
 */
function convertToSi(value, fromUnit, targetUnit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, reason: 'not_a_number' };
  }
  const spec = CONVERSIONS[fromUnit];
  if (!spec) return { ok: false, reason: 'unknown_unit' };
  if (spec.si !== targetUnit) return { ok: false, reason: 'unit_mismatch' };
  return { ok: true, value: spec.toSi(value), unit: spec.si };
}

module.exports = { convertToSi, CONVERSIONS };
