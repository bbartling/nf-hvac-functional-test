'use strict';

/**
 * @param {any} config
 * @param {Record<string, { value: number | boolean | null, age_s: number }>} readings
 * @param {{ outOfBandSince: number | null, staleStrikes: number }} memory
 * @param {number} now
 */
function evaluateInterlocks(config, readings, memory, now) {
  const limits = config.interlocks;
  const nextMemory = { outOfBandSince: memory.outOfBandSince, staleStrikes: memory.staleStrikes };
  const enabled = config._interlockCodes || null;
  const wanted = (code) => !enabled || enabled.includes(code);

  const staleRoles = Object.keys(readings).filter((role) => readings[role] && readings[role].age_s > config.limits.max_sample_age_s);
  if (staleRoles.length > 0) nextMemory.staleStrikes += 1;
  else nextMemory.staleStrikes = 0;
  if (wanted('stale_data') && nextMemory.staleStrikes >= 2) {
    return { trip: 'stale_data', memory: nextMemory };
  }

  const duct = readings.duct_static_pressure;
  if (wanted('duct_static_high') && duct && typeof duct.value === 'number' && duct.value > limits.duct_static_pressure_max_pa) {
    return { trip: 'duct_static_high', memory: nextMemory };
  }
  const damper = readings.outside_air_damper_command;
  const mixed = readings.mixed_air_temperature;
  if (wanted('mixed_air_low') && mixed && damper && typeof mixed.value === 'number' && typeof damper.value === 'number'
    && damper.value > 0 && mixed.value < limits.mixed_air_temperature_min_c) {
    return { trip: 'mixed_air_low', memory: nextMemory };
  }
  const discharge = readings.discharge_air_temperature;
  if (wanted('discharge_air_low') && discharge && typeof discharge.value === 'number' && discharge.value < limits.discharge_air_temperature_min_c) {
    return { trip: 'discharge_air_low', memory: nextMemory };
  }
  const fan = readings.supply_fan_run_status;
  if (wanted('fan_status_lost') && limits.fan_status_loss_abort && fan && fan.value === false) {
    return { trip: 'fan_status_lost', memory: nextMemory };
  }
  const freeze = readings.freeze_protection_status;
  if (wanted('freeze_protection') && limits.freeze_protection_status_abort && freeze && freeze.value === true) {
    return { trip: 'freeze_protection', memory: nextMemory };
  }
  const smoke = readings.smoke_alarm_status;
  if (wanted('smoke_alarm') && limits.smoke_alarm_status_abort && smoke && smoke.value === true) {
    return { trip: 'smoke_alarm', memory: nextMemory };
  }
  const zone = readings.zone_air_temperature;
  if (wanted('zone_out_of_band') && zone && typeof zone.value === 'number') {
    const outside = zone.value < limits.zone_air_temperature_min_c || zone.value > limits.zone_air_temperature_max_c;
    if (!outside) nextMemory.outOfBandSince = null;
    else if (nextMemory.outOfBandSince === null) nextMemory.outOfBandSince = now;
    else if (now - nextMemory.outOfBandSince >= 5 * 60 * 1000) return { trip: 'zone_out_of_band', memory: nextMemory };
  }
  return { trip: null, memory: nextMemory };
}

module.exports = { evaluateInterlocks };
