/** Checks the actual HTTP request shapes used by the final checkpoint. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=(await fs.readFile(new URL('../src/services/nexusApi.js', import.meta.url),'utf8'))
 .replace('import.meta.env.VITE_API_BASE_URL',"'http://localhost:8000'");
const {nexusApi,compareSavedResults}=await import(`data:text/javascript,${encodeURIComponent(src)}`);
const seen=[];
globalThis.fetch=async (url,options={})=>{
 const body=options.body?JSON.parse(options.body):null;
 seen.push({url,body});
 const response=url.endsWith('simulate-effective')?{scenario_signature:'s',feasible:true,coverage:{hospital_water:0},resilience_score:0,hospital_combined_coverage:0}:url.endsWith('/optimize')?{scenario_signature:'s',feasible:true,coverage:{hospital_water:100},resilience_score:74,hospital_combined_coverage:100}:url.endsWith('/explain')?{text:'Model-based explanation of a tested strategy',engine:'rules'}:{};
 return {ok:true,text:async()=>JSON.stringify(response)};
};
const scenario={temperature:50,water_available:12,energy_available:8};
const allocation={hospital_water:1,hospital_energy:0,pump_energy:0};
const human=await nexusApi.simulateEffective(scenario,allocation);
const nexus=await nexusApi.optimize(scenario);
const explanation=await nexusApi.explain('compare',scenario,human,nexus);
assert.equal(seen[0].url,'http://localhost:8000/simulate-effective');
assert.deepEqual(seen[0].body,{scenario,allocation});
assert.deepEqual(seen[1].body,scenario);
assert.equal(seen[2].body.mode,'compare');
assert.equal(explanation.engine,'rules');
assert.equal(compareSavedResults(human,nexus).score_difference,74);
assert.equal(compareSavedResults(human,nexus).comparison_valid,true);
assert.match(await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8'),/nexusApi\.simulateEffective\(scenario, allocation\)/);
const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
assert.ok(!app.includes('DEFAULT CASE</label>'));
assert.ok(app.includes('nexusApi.explain(kind, scenario, human, nexus)'));
console.log('PASS: human bad-token simulation, independent NEXUS and dynamic comparison narrator');
