import assert from 'node:assert/strict';
import { makeBackupSnapshot, solarScenarioKwh } from '../src/services/backupAccounting.js';
const scenario = { temperature: 42, water_available: 8, energy_available: 5, wind_speed: 8, pollution: 25 };
const sunny = solarScenarioKwh(scenario, { humidity: 30, sky: 'clear' });
const cloudy = solarScenarioKwh(scenario, { humidity: 30, sky: 'cloudy' });
assert(sunny > cloudy && cloudy > 0, 'Solar yield must depend on sky and environmental conditions');
const baseline = makeBackupSnapshot({scenario, sky:'clear'});
assert.equal(baseline.rainCollectedLiters, 0);
assert.equal(baseline.rainImpactWh, 0);
assert.equal(baseline.remainingWaterTokens, 8);
const rainy = makeBackupSnapshot({ scenario, mode:'human', solarModelKwh:1200,
    rainDeployed: true, rainfallMm:12,rainCaptureLiters:378,rainImpactWh:0.0309,
    outcome: { feasible:true, remaining_water:3,remaining_energy:1 }});
assert.equal(rainy.remainingWaterTokens, 3);
assert.equal(rainy.rainCollectedLiters, 378);
assert.equal(rainy.solarProducedKwh, 2.4);
assert.equal(rainy.availableEnergyWithUncreditedSolarKwh, 3.4);
assert(rainy.rainImpactWh > 0 && rainy.rainImpactWh < 1);
const credited = makeBackupSnapshot({scenario, solarModelKwh:1200, solarCreditedTokens:2});
assert(Math.abs(credited.availableEnergyWithUncreditedSolarKwh - 5.4) < 1e-9);
console.log('PASS: V9 backup source accounting / solar-varying / rain-only-if-deployed');
