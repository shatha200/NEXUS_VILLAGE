/** Dependency-free API contract smoke test. Run: node tests/test-api.mjs */
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/services/nexusApi.js', import.meta.url), 'utf8');
const moduleCode = source.replace('import.meta.env.VITE_API_BASE_URL', "'http://localhost:8000'");
const { nexusApi, compareSavedResults } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(moduleCode)}`);
const calls=[];
globalThis.fetch=async (url, options={})=>{
  calls.push({url,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  const response=url.endsWith('/simulate')?{feasible:true,scenario_signature:'same',resilience_score:55}:
                 url.endsWith('/optimize')?{feasible:true,scenario_signature:'same',resilience_score:74}:{};
  return {ok:true,text:async()=>JSON.stringify(response)};
};
const scenario={temperature:50,wind_speed:15}, allocation={hospital_water:1};
await nexusApi.previewCrisis(scenario);
const human=await nexusApi.simulate(scenario,allocation);
const nexus=await nexusApi.optimize(scenario);
await nexusApi.predictWeather(scenario,{humidity:70,sky:'cloudy',hour:12,month:7});
await nexusApi.predictVillage({...scenario,water_available:12,energy_available:8,grid_status:'OFF',pump_operational:true},{humidity:62,sky:'cloudy',month:7});
const comparison=compareSavedResults(human,nexus);
if (comparison.score_difference!==19) throw Error('Comparison mismatch');
if (calls[1].body.allocation.hospital_water!==1 || calls[2].body.temperature!==50)throw Error('Input schema mismatch');
if (calls[3].body.humidity!==70 || calls[3].body.wind_speed!==15)throw Error('Weather input mismatch');
if(calls[4].body.water_available!==12 || calls[4].body.humidity!==62)throw Error('Village ML request mismatch');
let rejected=false;
try{ compareSavedResults(human,{...nexus,scenario_signature:'different'}) }catch{rejected=true}
if(!rejected)throw Error('Different crises should not be comparable');
console.log('PASS: frontend API methods, request fields and saved comparison');
