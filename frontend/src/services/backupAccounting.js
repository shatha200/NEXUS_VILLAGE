/** Honest 24-hour demo accounting. Pure functions so they can be tested without a browser. */
export const SOLAR_SCALE = 0.002; // reference-village ML model -> tabletop illustration, NOT calibrated
export const SOLAR_BATTERY_CAP_KWH = 4;
export const RAIN_STORAGE_MAX_L = 650;
export function solarScenarioKwh({temperature=30, pollution=0, wind_speed=0, grid_status='ON'}, {humidity=60,sky='clear'}={}) {
  // Fallback theoretical panel yield: 8 m² * 19% * 0.72kW/m² * equivalent sun hours.
  // Temperature only derates conversion; sky, humidity and pollution modulate irradiation.
  const sunHours=sky==='clear'?5.1:sky==='partly cloudy'?3.2:1.25;
  const humidityFactor=Math.max(.65,1-.0025*Math.max(0,humidity-45));
  const pollutionFactor=Math.max(.70,1-.002*Math.max(0,pollution));
  const tempFactor=Math.max(.65,1-.004*Math.max(0,temperature-25));
  const windCooling=1+Math.min(.04,Math.max(0,wind_speed)*.001);
  return Math.max(0,8*.19*.72*sunHours*humidityFactor*pollutionFactor*tempFactor*windCooling);
}
export function makeBackupSnapshot({scenario, outcome=null, solarModelKwh=null, humidity=65, sky='cloudy', rainDeployed=false, rainfallMm=0, rainCaptureLiters=0, rainImpactWh=0, solarCreditedTokens=0, mode='crisis'}) {
  const estimated=Number.isFinite(Number(solarModelKwh))&&solarModelKwh!==null;
  const solarProducedKwh=estimated?Math.max(0,Number(solarModelKwh)*SOLAR_SCALE):solarScenarioKwh(scenario,{humidity,sky});
  const storedSolarKwh=Math.min(SOLAR_BATTERY_CAP_KWH,solarProducedKwh);
  const finalWater=outcome?.feasible ? Number(outcome.remaining_water ?? scenario.water_available):Number(scenario.water_available);
  const finalEnergy=outcome?.feasible ? Number(outcome.remaining_energy ?? scenario.energy_available):Number(scenario.energy_available);
  return {
    mode, initialWaterTokens:scenario.water_available, initialEnergyTokens:scenario.energy_available,
    remainingWaterTokens:finalWater, remainingEnergyTokens:finalEnergy,
    solarRawModelKwh:estimated?Number(solarModelKwh):null,
    solarProducedKwh, storedSolarKwh, solarCreditsAppliedTokens:solarCreditedTokens,
    solarSource:estimated?'trained synthetic reference model × 0.002 (demo scale)':'local theoretical panel estimate (not ML)',
    rainCollectedLiters:rainDeployed?Math.min(RAIN_STORAGE_MAX_L,Math.max(0,rainCaptureLiters)):0,
    rainImpactWh:rainDeployed?Math.max(0,rainImpactWh):0,
    rainSource:rainDeployed?`collector deployed · ${Number(rainfallMm).toFixed(1)} mm`:'no deployed rain collector',
    // Do not double-count predicted solar in available energy: it is a separate possible backup.
    availableEnergyWithUncreditedSolarKwh:finalEnergy+Math.max(0,storedSolarKwh-solarCreditedTokens),
    limitations:'Solar storage is an assumed battery, not metered. Rain is non-potable; droplet impact cannot power hospital equipment.'
  };
}
