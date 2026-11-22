/** Deterministic client-side resource accounting (backend remains authoritative). */
export const INITIAL_ALLOCATION = Object.freeze({
  hospital_water:0, household_water:0, agriculture_water:0,
  hospital_energy:0, pump_energy:0, source_water:0
});
export const DROP_MAP = Object.freeze({
  water: {hospital:'hospital_water',households:'household_water',agriculture:'agriculture_water',pump:'source_water'},
  energy: {hospital:'hospital_energy',pump:'pump_energy',agriculture:'pump_energy'}
});
export const WATER_KEYS=['hospital_water','household_water','agriculture_water','source_water'];
export const ENERGY_KEYS=['hospital_energy','pump_energy'];
export const RAIN_AREA_M2=42, RAIN_EFFICIENCY=.75, RAIN_TANK_LITERS=650;
export const RAIN_MIN_PROB=.70, RAIN_MIN_EXPECTED_MM=8, RAIN_MIN_CAPTURE_L=200;
export function remainingCoins(scenario,allocation){
  const water=Math.max(0,scenario.water_available-WATER_KEYS.reduce((sum,key)=>sum+(allocation[key]||0),0));
  const energy=Math.max(0,scenario.energy_available-ENERGY_KEYS.reduce((sum,key)=>sum+(allocation[key]||0),0));
  return {water,energy};
}
export function adjustedAllocation(scenario,allocation,key,newValue){
  const keys=WATER_KEYS.includes(key)?WATER_KEYS:ENERGY_KEYS;
  if(!keys.includes(key)) throw Error(`Unknown token field: ${key}`);
  const resource=WATER_KEYS.includes(key)?'water':'energy';
  const limit=scenario[resource+'_available'];
  const next=Math.max(0,Math.floor(Number(newValue)||0));
  const other=keys.filter(k=>k!==key).reduce((sum,k)=>sum+(allocation[k]||0),0);
  if(next+other>limit) return {allocation,error:`Only ${Math.max(0,limit-other)} ${resource} tokens available for this zone`};
  return {allocation:{...allocation,[key]:next},error:null};
}
export function rainLiters(mm){return Math.min(RAIN_TANK_LITERS,Math.max(0,Number(mm)||0)*RAIN_AREA_M2*RAIN_EFFICIENCY);}
export function eligibleRain(f){return !!f && Number(f.rainfall_mm)>=RAIN_MIN_EXPECTED_MM && rainLiters(f.rainfall_mm)>=RAIN_MIN_CAPTURE_L && (f.probability===null || f.probability>=RAIN_MIN_PROB);}
/** Tiny illustrative 2%-efficient 1.5m droplet head harvest, watt-hours, never kWh tokens. */
export function microEnergyWh(liters){return liters*9.81*1.5*.02/3600;}
