const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? {'Content-Type': 'application/json'} : {}),
        'ngrok-skip-browser-warning': 'true',
        ...options.headers
      }
    });
  } catch (e) {
    throw new Error(`Cannot connect to NEXUS backend at ${BASE_URL}. Check that the server or ngrok is running. ${e.message}`);
  }
  const raw = await response.text();
  let data;
  try {data = raw ? JSON.parse(raw) : {}} catch {throw new Error(`Non-JSON response at ${path}; check API URL / ngrok.`)}
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    throw new Error(`API ${response.status}: ${detail}`);
  }
  return data;
}

export const nexusApi = {
  health: () => request('/health'),
  modelStatus: () => request('/model-status-full'),
  predictVillage: (scenario, conditions={}) => request('/predict-village', {method:'POST', body:JSON.stringify({
    temperature:scenario.temperature, wind_speed:scenario.wind_speed,
    water_available:scenario.water_available, energy_available:scenario.energy_available,
    grid_status:scenario.grid_status, pump_operational:scenario.pump_operational,
    humidity:conditions.humidity ?? 65, sky:conditions.sky ?? 'cloudy', month:conditions.month ?? 7
  })}),
  scenarios: () => request('/scenarios'),
  previewCrisis: scenario => request('/crisis-preview', {method:'POST', body: JSON.stringify(scenario)}),
  simulate: (scenario, allocation) => request('/simulate', {method:'POST', body: JSON.stringify({scenario, allocation})}),
  simulateEffective: (scenario, allocation) => request('/simulate-effective', {method:'POST', body:JSON.stringify({scenario, allocation})}),
  explain: (mode, scenario, human=null, nexus=null) => request('/explain', {method:'POST', body:JSON.stringify({mode, scenario, human, nexus})}),
  narrativeStatus: () => request('/narrative-status'),
  optimize: scenario => request('/optimize', {method:'POST', body: JSON.stringify(scenario)}),
  compare: (scenario, allocation) => request('/compare', {method:'POST', body: JSON.stringify({scenario, allocation})}),
  predictWeather: (scenario, conditions={}) => request('/predict-weather', {method:'POST',body:JSON.stringify({
    temperature:scenario.temperature, wind_speed:scenario.wind_speed,
    humidity:conditions.humidity ?? 60,
    sky:conditions.sky ?? 'cloudy',
    hour:conditions.hour ?? 12,
    month:conditions.month ?? 7
  })})
};

function hospitalSummary(result){return `${Number(result.hospital_combined_coverage??0).toFixed(0)}% coverage`;}
export function compareSavedResults(human, nexus) {
  if (!human?.feasible || !nexus?.feasible) throw new Error('Both simulations must be feasible before comparison.');
  if (!human.scenario_signature || !nexus.scenario_signature || human.scenario_signature!==nexus.scenario_signature)
    throw new Error('These decisions were simulated under different crisis configurations. Simulate both again.');
  const diff=Number((nexus.resilience_score-human.resilience_score).toFixed(2));
  const h=hospitalSummary(human),n=hospitalSummary(nexus);
  const sectors=['hospital_water','hospital_energy','household_water','agriculture_water'];
  const gains=sectors.filter(k=>(nexus.coverage?.[k]??0)>(human.coverage?.[k]??0)+.01);
  const losses=sectors.filter(k=>(nexus.coverage?.[k]??0)+.01<(human.coverage?.[k]??0));
  const conclusion=diff>0 ? `Under the declared service weights NEXUS scores ${diff} points higher. Better coverage: ${gains.join(', ')||'no specific sector'}; trade-offs: ${losses.join(', ')||'none'}. Hospital ${h} → ${n}.` : diff<0 ? `Human scores ${-diff} points higher under the declared metric; review optimizer/model consistency. Hospital ${h} → ${n}.` : `Both strategies score equally; allocations and sector trade-offs may still differ. Hospital ${h} → ${n}.`;
  return {human,nexus,comparison_valid:true,score_difference:diff,conclusion,message:'Compared two independently saved simulations under the identical crisis; no re-optimization.'};
}
