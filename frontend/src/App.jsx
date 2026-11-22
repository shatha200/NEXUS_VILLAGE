import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, Bot, Droplets, Eye, GitCompareArrows, Hand, Lightbulb,
  Play, SlidersHorizontal, Sparkles, X, Zap, CloudRain, Umbrella, CloudSun
} from "lucide-react";
import Village3D from "./components/Village3D";
import Interior3D from "./components/Interior3D";
import Logo from "./components/Logo";
import NexusNarrator from "./components/NexusNarrator";
import { nexusApi, compareSavedResults } from "./services/nexusApi";
import { makeBackupSnapshot } from "./services/backupAccounting";
import {INITIAL_ALLOCATION, DROP_MAP, WATER_KEYS, ENERGY_KEYS,
  remainingCoins, adjustedAllocation, rainLiters, eligibleRain, microEnergyWh
} from "./services/simulationRules";

/* ---------- same scenarios / allocation contract as the previous frontend ---------- */
const fallbackScenarios = {
  moderate: { temperature: 38, water_available: 18, energy_available: 22, grid_status: "ON", pump_operational: true, wind_speed: 10, pollution: 25 },
  heatwave: { temperature: 45, water_available: 14, energy_available: 12, grid_status: "ON", pump_operational: true, wind_speed: 5, pollution: 40 },
  compound_crisis: { temperature: 50, water_available: 12, energy_available: 8, grid_status: "OFF", pump_operational: true, wind_speed: 15, pollution: 70 },
  water_shortage: { temperature: 42, water_available: 6, energy_available: 18, grid_status: "ON", pump_operational: true, wind_speed: 8, pollution: 30 },
  pump_failure: { temperature: 46, water_available: 12, energy_available: 15, grid_status: "ON", pump_operational: false, wind_speed: 12, pollution: 30 }
};
const scenarioNames = { moderate: "Moderate stress", heatwave: "Extreme heatwave", compound_crisis: "Compound catastrophe", water_shortage: "Water shortage", pump_failure: "Pump failure" };
const initialAllocation = {...INITIAL_ALLOCATION};
const ZONES = [
  { id: "hospital", title: "Hospital", rows: [["hospital_water", "Water", "water"], ["hospital_energy", "Energy", "energy"]] },
  { id: "households", title: "Houses", rows: [["household_water", "Water", "water"]] },
  { id: "agriculture", title: "Agriculture", rows: [["agriculture_water", "Water", "water"]] },
  { id: "pump", title: "Water source and pumps", rows: [["source_water", "Water kept in reserve", "water"], ["pump_energy", "Pump energy", "energy"]] }
];
const TABS = [["crisis", "CRISIS", SlidersHorizontal], ["distribute", "DISTRIBUTE", Hand], ["nexus", "NEXUS", Bot], ["compare", "COMPARE", GitCompareArrows]];
const VIEW_BUTTONS = [["overview", "OVERVIEW"], ["z1", "ZONE 1"], ["z2", "ZONE 2"], ["z3", "ZONE 3"]];

/* ---------- visual state model (what the 3D village displays) ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// The editing form is NOT the simulated world. The scene stays neutral until SIMULATE is pressed.
const NEUTRAL_SCENARIO = {temperature: 28, water_available: 20, energy_available: 24, grid_status: "ON", pump_operational: true, wind_speed: 4, pollution: 5};
function baseState() {
  return {hospital:1, homes:1, agri:1, tank:0.85, pump:true, irrigate:true,
    hospitalWater:true, householdWater:true, agricultureWater:true, hospitalEnergy:true};
}
// Preview shows unallocated crisis risk; it NEVER invents delivered water or power.
function crisisTarget(s, metrics={}) {
  const heat=clamp((s.temperature-30)/25);
  return {
    hospital: metrics.hospital ?? clamp(.85-heat*.3-(s.grid_status==='OFF'?.35:0)),
    homes: metrics.homes ?? clamp(.85-heat*.25),
    agri: metrics.agri ?? clamp(.8-heat*.38),
    tank: metrics.tank ?? clamp(s.water_available/25),
    pump:false, irrigate:false, hospitalWater:false, householdWater:false,
    agricultureWater:false, hospitalEnergy:false
  };
}
function outcomeFrom(res,s) {
  const c=res.coverage || {}, a=res.allocation||{};
  const hospitalWater=(a.hospital_water||0)>0 && (a.pump_energy||0)>0 && s.pump_operational;
  const householdWater=(a.household_water||0)>0 && (a.pump_energy||0)>0 && s.pump_operational;
  const agricultureWater=(a.agriculture_water||0)>0 && (a.pump_energy||0)>0 && s.pump_operational;
  const pump=s.pump_operational && (a.pump_energy||0)>0 && (hospitalWater||householdWater||agricultureWater);
  return {
    hospital:clamp((res.hospital_combined_coverage ?? Math.min(c.hospital_water??0,c.hospital_energy??0))/100),
    homes:clamp((c.household_water??0)/100), agri:clamp((c.agriculture_water??0)/100),
    tank:clamp((res.remaining_water??0)/Math.max(1,s.water_available)),
    pump,irrigate:agricultureWater,hospitalWater,householdWater,agricultureWater,
    hospitalEnergy:(a.hospital_energy||0)>0
  };
}
/* ---------- small UI parts ---------- */
function Slider({ label, unit = "", value, min, max, onChange }) {
  return (
    <label className="field">
      <span>{label}<b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
function Stepper({ value, onChange, label }) {
  return (
    <div className="stepper">
      <button aria-label={`Decrease ${label}`} onClick={() => onChange(value - 1)}>−</button>
      <b>{value}</b>
      <button aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
function Pill({ value }) {
  const v = String(value || "unknown").toLowerCase();
  const cls = /stab|ok|avail|good/.test(v) ? "ok" : /risk|warn|under/.test(v) ? "risk" : "crit";
  return <span className={`pill ${cls}`}>{v.replaceAll("_", " ")}</span>;
}
function Result({ title, result, tone }) {
  if (!result) return null;
  const n = Number(result.resilience_score);
  const score = Number.isFinite(n) ? n : null;
  return (
    <section className="result">
      <div className="result-top">
        <div><span className="mono dim">SIMULATION OUTPUT</span><h3>{title}</h3></div>
        <div className="ring" style={{ "--v": `${score ?? 0}%`, "--c": tone }}><div><b>{score === null ? "—" : score.toFixed(1)}</b><small>/100</small></div></div>
      </div>
      {!result.feasible && <div className="warn"><AlertTriangle size={16} /><div><b>Infeasible allocation</b>{(result.violations || []).map((v, i) => <p key={i}>{v}</p>)}</div></div>}
      {Object.entries(result.sector_status || {}).map(([k, v]) => <div className="row" key={k}><span>{k.replaceAll("_", " ")}</span><Pill value={v} /></div>)}
      {Object.entries(result.coverage || {}).map(([k, v]) => (
        <div className="cov" key={k}><span>{k.replaceAll("_", " ")}</span><b>{Number(v).toFixed(1)}%</b><i><u style={{ width: `${clamp(Number(v), 0, 100)}%` }} /></i></div>
      ))}
      <div className="row"><span>Remaining water <b>{result.remaining_water ?? "—"}</b></span><span>Remaining energy <b>{result.remaining_energy ?? "—"}</b></span></div>
      {result.requested_allocation && Object.keys(result.shortfalls||{}).length>0 && <div className="warn"><AlertTriangle size={15}/><div><b>Requested vs actually delivered</b>{Object.entries(result.shortfalls).map(([k,v])=><p key={k}>{k.replaceAll('_',' ')}: {v} token(s) unavailable for delivery</p>)}</div></div>}
      {(result.explanation || []).length > 0 && <div className="explain"><b><Lightbulb size={14} /> Backend explanation</b>{result.explanation.map((x, i) => <p key={i}>• {x}</p>)}</div>}
      {result.recommendation && <div className="reco"><Sparkles size={15} />{result.recommendation}</div>}
    </section>
  );
}

function BackupStorageModal({snapshot,onClose}) {
  return <div className="backup-overlay" onMouseDown={onClose}>
    <section className="backup-dialog" role="dialog" aria-modal="true" aria-label="Backup storage ledger" onMouseDown={e=>e.stopPropagation()}>
      <div className="backup-title"><div><span className="mono">NEXUS · RESOURCE RESILIENCE</span><h2>BACKUP STORAGE</h2></div><button onClick={onClose} aria-label="Close storage" className="x"><X size={19}/></button></div>
      {!snapshot ? <div className="backup-empty"><Activity size={26}/><h3>No completed simulation yet</h3><p>Run Simulate Crisis, Human or NEXUS. This depot records the most recent executed scenario, not changes to the input sliders.</p></div> : <>
        <p className="backup-caption">Latest completed mode: <strong>{snapshot.mode.toUpperCase()}</strong>. All resources are illustrative.</p>
        <div className="backup-grid">
          <article className="backup-tile water"><Droplets/><small>Main reservoir · remaining</small><strong>{snapshot.remainingWaterTokens} blue tokens</strong><span>{(snapshot.remainingWaterTokens*5000).toLocaleString()} L · initial {snapshot.initialWaterTokens} tokens</span></article>
          <article className="backup-tile energy"><Zap/><small>Usable budget · remaining</small><strong>{snapshot.remainingEnergyTokens} yellow tokens</strong><span>{snapshot.remainingEnergyTokens} kWh · initial {snapshot.initialEnergyTokens} tokens</span></article>
          <article className="backup-tile sun"><CloudSun/><small>Solar generation · 24h estimate</small><strong>{snapshot.solarProducedKwh.toFixed(2)} kWh</strong><span>{snapshot.solarSource}</span><span>Potential battery storage: {snapshot.storedSolarKwh.toFixed(2)} kWh (max 4 kWh)</span><span>Already credited to crisis budget: {snapshot.solarCreditsAppliedTokens} kWh</span></article>
          <article className="backup-tile rain"><CloudRain/><small>Rain tank · separate non-potable</small><strong>{snapshot.rainCollectedLiters.toFixed(0)} L</strong><span>{snapshot.rainSource}</span><span>Rain-impact micro-energy: {snapshot.rainImpactWh.toFixed(4)} Wh (0 whole tokens)</span></article>
        </div>
        <div className="backup-notice">Solar is projected production, not automatically counted twice as usable energy. The rain tank is separate and is not pumpable potable water. The experimental rain-impact amount does not power the hospital.</div>
      </>}
    </section>
  </div>;
}

function InteriorModal({type, scenario, result, target, onClose}) {
  const hospital=type==='hospital';
  const energy=(result?.coverage?.hospital_energy ?? (scenario.grid_status==='OFF'?0:100));
  const water=(result?.coverage?.hospital_water ?? target.hospital*100);
  const households=result?.coverage?.household_water ?? target.homes*100;
  const critical=hospital ? (energy<25 || water<25) : (households<30);
  return <div className="interior-backdrop" onMouseDown={onClose}>
    <div className="interior" role="dialog" aria-modal="true" aria-label={hospital?'Hospital interior':'Household interior'} onMouseDown={e=>e.stopPropagation()}>
      <button className="interior-close" onClick={onClose}><X size={18}/> EXIT BUILDING</button>
      <div className="interior-kicker">NEXUS VILLAGE · INSPECTION / {hospital?'ZONE 1 HOSPITAL':'ZONE 1 HOUSEHOLD'}</div>
      <h2>{hospital?'HÔPITAL · المستشفى':'HOME · MAISON TUNISIENNE'}</h2>
      <Interior3D hospital={hospital} energy={energy} water={water} households={households} grid={scenario.grid_status}/>
      <div className="room-stats">
        {hospital?<><span>Hospital energy coverage <b>{Math.round(energy)}%</b></span><span>Hospital water coverage <b>{Math.round(water)}%</b></span></>:
        <><span>Household water coverage <b>{Math.round(households)}%</b></span><span>Grid <b>{scenario.grid_status}</b></span></>}
      </div>
      <p className="room-disclaimer">{hospital?'Illustrative emergency-ward visualization. Motionless figures indicate patients at severe risk, not confirmed fatalities. NEXUS does not predict deaths.':'Illustrative depiction of limited food/water access under sustained disruption. A 24-hour water allocation alone cannot establish actual food scarcity.'}</p>
    </div>
  </div>;
}

export default function App() {
  const [scenarios, setScenarios] = useState(fallbackScenarios);
  const [scenarioId, setScenarioId] = useState("compound_crisis");
  const [scenario, setScenario] = useState(fallbackScenarios.compound_crisis);
  const [sceneScenario, setSceneScenario] = useState(NEUTRAL_SCENARIO);
  const [allocation, setAllocation] = useState(initialAllocation);
  const [humanResult, setHumanResult] = useState(null);
  const [nexusResult, setNexusResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [mode, setMode] = useState("idle"); // idle | crisis | human | nexus
  const [tab, setTab] = useState("crisis");
  const [open, setOpen] = useState(true);
  const [apiStatus, setApiStatus] = useState("checking");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState({ name: "overview", n: 0 });
  const [hoverZone, setHoverZone] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [rainSuggestion, setRainSuggestion] = useState(false);
  const [inspected, setInspected] = useState(null);
  // Optional experimental weather module. The backend's existing scenario schema remains unchanged.
  const [forecast, setForecast] = useState(null);
  const [demoRainfall, setDemoRainfall] = useState(12);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [humidity, setHumidity] = useState(65);
  const [sky, setSky] = useState('cloudy');
  const [forecastHour, setForecastHour] = useState(12);
  const [forecastMonth, setForecastMonth] = useState(7);
  const [crisisPreview, setCrisisPreview] = useState(null);
  const [villageForecast, setVillageForecast] = useState(null);
  const [villageBusy, setVillageBusy] = useState(false);
  const [rainDeployed, setRainDeployed] = useState(false);
  const [narration, setNarration] = useState(null);
  const [solarCredit, setSolarCredit] = useState(0);
  const [solarCreditApplied,setSolarCreditApplied]=useState(false);
  const [solarReport, setSolarReport] = useState(null);
  const [backupSnapshot,setBackupSnapshot] = useState(null);
  const [storageOpen,setStorageOpen] = useState(false);
  const weather = {
    ...(forecast||{}),
    deployed: rainDeployed && Number(forecast?.rainfall_mm)>0,
    captured_liters: rainDeployed?rainLiters(forecast?.rainfall_mm):0,
    micro_energy_wh: rainDeployed?microEnergyWh(rainLiters(forecast?.rainfall_mm)):0
  };


  const progressRef = useRef(0), rafRef = useRef(0), clockRef = useRef(null), barRef = useRef(null), pickRef = useRef(null), lastPick = useRef(0);

  useEffect(() => {
    let alive = true;
    nexusApi.health().then(() => alive && setApiStatus("online")).catch(() => alive && setApiStatus("offline"));
    nexusApi.scenarios().then((d) => { if (alive && d?.scenarios) { setScenarios(d.scenarios); if (d.scenarios.compound_crisis) setScenario(d.scenarios.compound_crisis); } }).catch(() => {});
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);

  const {water:waterTokens,energy:energyTokens}=remainingCoins(scenario,allocation);

  /* Render ONLY the last committed simulation, never a slider edit. */
  const base = useMemo(() => baseState(), []);
  const target = useMemo(() => {
    if(mode==='crisis') return crisisTarget(sceneScenario,crisisPreview?.visual_metrics);
    if(mode==='human' && humanResult?.feasible) return outcomeFrom(humanResult,sceneScenario);
    if(mode==='nexus' && nexusResult?.feasible) return outcomeFrom(nexusResult,sceneScenario);
    return base;
  },[mode,sceneScenario,crisisPreview,humanResult,nexusResult,base]);
  const coinSource = mode==='human' ? allocation : mode==='nexus' ? nexusResult?.allocation : null;
  const coins = coinSource ? {
    hospital: {w:coinSource.hospital_water,e:coinSource.hospital_energy},
    households:{w:coinSource.household_water},
    agriculture:{w:coinSource.agriculture_water},
    pump:{e:coinSource.pump_energy,w:coinSource.source_water||0}
  } : null;

  function play() {
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now(), DUR = 9000;
    const tick = (now) => {
      const p = clamp((now - t0) / DUR);
      progressRef.current = p;
      const mins = Math.floor(p * 24 * 60);
      if (clockRef.current) clockRef.current.textContent = `T+ ${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }
  function resetPlayback() {
    cancelAnimationFrame(rafRef.current); progressRef.current = 0;
    if (clockRef.current) clockRef.current.textContent = "T+ 00:00";
    if (barRef.current) barRef.current.style.width = "0%";
  }
  function invalidate() { setNarration(null); setVillageForecast(null); setCrisisPreview(null); setForecast(null); setRainDeployed(false);setRainSuggestion(false); setHumanResult(null); setNexusResult(null); setCompareResult(null); setMode("idle"); resetPlayback(); }

  function updateScenario(key, value) { setSolarCredit(0);setSolarCreditApplied(false); setSolarReport(null); setScenario((p) => ({ ...p, [key]: value })); invalidate(); }
  function selectScenario(id) { setSolarCredit(0);setSolarCreditApplied(false);setSolarReport(null); setScenarioId(id); setScenario({ ...(scenarios[id] || fallbackScenarios[id]) }); invalidate(); setError(""); }
  function changeAllocation(key,value) {
    const updated=adjustedAllocation(scenario,allocation,key,value);
    if(updated.error) return setToast(updated.error);
    setAllocation(updated.allocation);
    setHumanResult(null);setCompareResult(null);setNarration(null);
    if(mode==='human'){setMode('idle');resetPlayback();}
  }
  function placeCoin(type,zone){
    const key=DROP_MAP[type]?.[zone];
    if(!key) return setToast('This resource cannot be assigned to that zone.');
    if((type==='water'?waterTokens:energyTokens)<=0) return setToast(`No ${type} coins left`);
    changeAllocation(key,allocation[key]+1);
    setToast(key==='source_water'?'Water token reserved at source (not delivered).':'Coin placed in '+zone);
  }

  async function predictWeather() {
    setWeatherBusy(true); setForecast(null); setRainDeployed(false); setError('');
    try {
      // This endpoint is OPTIONAL: only claim "forecast" when a real backend model replies.
      const data=await nexusApi.predictWeather(scenario, {humidity, sky, hour:forecastHour, month:forecastMonth});
      const prob=Number(data.rain_probability ?? data.rain_probability_percent/100);
      const mm=Number(data.precipitation_mm_6h_expected ?? data.rainfall_mm ?? 0);
      if(!Number.isFinite(prob)||!Number.isFinite(mm)||prob<0||prob>1||mm<0) throw new Error('Unexpected weather model response');
      const prediction={probability:prob,rainfall_mm:mm,source:'trained Colab rainfall model',label:`MODEL ESTIMATE · ${data.horizon_hours ?? 6}H`,horizon:data.horizon_hours ?? 6};
      setForecast(prediction);
      setRainSuggestion(eligibleRain(prediction));
      setToast(eligibleRain(prediction)?'Rain harvesting opportunity: review the deployment proposal':'Forecast received. Rain collection is not recommended.');
    } catch(err) {
      // Never invent a meteorological prediction from temperature, wind and pollution.
      setError('Weather model unavailable. You can still run the clearly labelled DEMO rain scenario. '+err.message);
    } finally {setWeatherBusy(false);}
  }
  async function predictVillage() {
    setVillageBusy(true); setVillageForecast(null); setError('');
    try {
      const forecast = await nexusApi.predictVillage(scenario,{humidity, sky, month:forecastMonth});
      if(!forecast.model_ready || !forecast.totals) throw new Error('Invalid village model response');
      setVillageForecast(forecast);
      setSolarReport({rawKwh:Number(forecast.totals.solar_energy_kwh||0),scale:0.002});
      setSolarCreditApplied(false);
      setToast('Trained demand and solar models evaluated (reference village)');
    } catch(err) {setError('Village model prediction unavailable: '+err.message)}
    finally {setVillageBusy(false)}
  }
  function applySolarCredit(){
    if(!solarReport && !backupSnapshot)return setError('Simulate a crisis to estimate solar generation first.');
    if(solarCreditApplied)return setToast('This forecast has already been credited once.');
    // Reference ML covers a synthetic ~3,000-person community. 1% is an
    // explicit tabletop DEMO assumption, not a measured hospital conversion.
    const credit=Math.max(0,Math.min(4,Math.floor(backupSnapshot?.storedSolarKwh ?? solarReport.rawKwh*solarReport.scale)));
    if(credit===0)return setToast('Calibrated solar generation is below one energy-token threshold.');
    const available=Math.min(1000,scenario.energy_available+credit);
    const applied=available-scenario.energy_available;
    setScenario(prev=>({...prev,energy_available:available}));
    setSolarCredit(prev=>prev+applied);
    setSolarCreditApplied(true);
    setBackupSnapshot(prev=>prev?{...prev,solarCreditsAppliedTokens:prev.solarCreditsAppliedTokens+applied}:prev);
    // Simulation must be rerun on the modified stock; never silently change 3D.
    setHumanResult(null);setNexusResult(null);setCompareResult(null);setCrisisPreview(null);
    setMode('idle');setNarration(null);resetPlayback();
    setToast(`Added ${applied} DEMO solar energy tokens. Run Simulate Crisis and both decisions again.`);
  }
  function useDemoWeather(){
    const f={probability:null,rainfall_mm:demoRainfall,source:'user-defined scenario',label:'DEMO RAIN — NOT A FORECAST'};
    setForecast(f);setRainSuggestion(eligibleRain(f));setRainDeployed(false);setError('');
  }
  function activateRain(){
    if(!eligibleRain(forecast)) return setError('Harvesting is not recommended: needs >=70% rain probability (trained forecast), >=8mm expected rain and >=200L capture.');
    setRainDeployed(true);setRainSuggestion(false);
    if(mode!=='idle') recordBackup(sceneScenario,mode==='human'?humanResult:mode==='nexus'?nexusResult:null,mode,{deployed:true});
    setToast('Emergency roof capture deployed: non-potable water stored in separate tank');
  }
  function recordBackup(s, outcome=null, modeName='crisis', override={}) {
    const f=override.forecast ?? forecast;
    const deployed=override.deployed ?? rainDeployed;
    const captured=deployed?rainLiters(f?.rainfall_mm):0;
    const raw=override.modelKwh ?? solarReport?.rawKwh ?? villageForecast?.totals?.solar_energy_kwh ?? null;
    setBackupSnapshot(makeBackupSnapshot({scenario:s,outcome,mode:modeName,
      solarModelKwh:raw,humidity,sky,rainDeployed:deployed,rainfallMm:f?.rainfall_mm||0,
      rainCaptureLiters:captured,rainImpactWh:microEnergyWh(captured),solarCreditedTokens:solarCredit}));
  }
  async function runCrisis() {
    setBusy('crisis'); setError('');
    try {
      const preview=await nexusApi.previewCrisis(scenario);
      // Forecast model is optional. Do not block crisis simulation if unavailable.
      let modelKwh=null;
      try { const vf=await nexusApi.predictVillage(scenario,{humidity,sky,month:forecastMonth});
        if(Number.isFinite(Number(vf?.totals?.solar_energy_kwh))){
          modelKwh=Number(vf.totals.solar_energy_kwh); setVillageForecast(vf);
          setSolarReport({rawKwh:modelKwh,scale:0.002});
        }
      } catch(_) { /* labeled theoretical fallback in backup ledger */ }
      recordBackup(scenario,null,'crisis',{modelKwh});
      setCrisisPreview(preview);setSceneScenario({...scenario});
      setMode('crisis'); setOpen(false); play();
      setToast('Backend crisis preview loaded. No resource allocation has been applied.');
    } catch(e){setError(e.message);setOpen(true);} finally{setBusy('');}
  }
  // Deliberately non-blocking: model text is optional. Allocations/scores are
  // always computed by FastAPI; a server LLM only verbalizes those numbers.
  async function narrate(kind, human, nexus) {
    try {
      const response=await nexusApi.explain(kind, scenario, human, nexus);
      if(response?.text)setNarration({text:response.text, engine:response.engine});
    } catch(err){
      setNarration({text:`The ${kind} simulation is complete; view the exact sector coverage and resource accounting in the panel. Narrative service unavailable.`,engine:'rules'});
    }
  }
  async function runHuman() {
    setBusy("human"); setError(""); setTab("distribute");
    try {
      // A bad decision must produce a bad outcome, not reject the entire demo.
      // This endpoint calculates delivered water under actual pump constraints.
      const data = await nexusApi.simulateEffective(scenario, allocation);
      setHumanResult(data); setCompareResult(null);
      recordBackup(scenario,data,'human');
      if(data.feasible){setSceneScenario({...scenario});setMode('human');play();}
      setToast("Human decision evaluated: effective delivery shown for each zone");
      void narrate('human',data,null);
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  }
  async function runNexus() {
    setBusy("nexus"); setError(""); setTab("nexus");
    try {
      // IMPORTANT: the optimizer receives the original committed crisis budget,
      // never the leftover or manually assigned coins.
      const data = await nexusApi.optimize(scenario);
      setNexusResult(data); setCompareResult(null);
      recordBackup(scenario,data,'nexus');setSceneScenario({...scenario}); setMode("nexus"); play();
      setToast("NEXUS solved the full crisis resource budget");
      void narrate('nexus',null,data);
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  }
  function runCompare() {
    if (!humanResult?.feasible || !nexusResult?.feasible) {
      setError("Run both Human and NEXUS once before comparing. Zero-token decisions are valid.");
      setTab('compare');setOpen(true);return;
    }
    try {
      const comparison=compareSavedResults(humanResult,nexusResult);
      setCompareResult(comparison);setTab('compare');setOpen(true);setError('');
      void narrate('compare',humanResult,nexusResult);
    } catch(e){setError(e.message);setOpen(true);}
  }

  /* Desktop drag/drop and touchpad click-to-select with 3D raycast zones. */
  function onDragOver(e){ if(!dragging)return; e.preventDefault(); const now=performance.now(); if(now-lastPick.current<60)return;lastPick.current=now;setHoverZone(pickRef.current?.(e.clientX,e.clientY)||null); }
  function onDrop(e){e.preventDefault();const type=e.dataTransfer?.getData('text/coin')||dragging;
    const zone=pickRef.current?.(e.clientX,e.clientY);
    setDragging(null);setHoverZone(null);if(!zone)return setToast('Drop a coin onto a highlighted zone');placeCoin(type,zone);
  }
  function onZoneClick(zone){if(!selectedCoin)return false;placeCoin(selectedCoin,zone);setSelectedCoin(null);return true;}
  const startDrag=(type)=>(e)=>{e.dataTransfer.setData('text/coin',type);e.dataTransfer.effectAllowed='copy';setDragging(type);};
  const endDrag=()=>{setDragging(null);setHoverZone(null);};
  function dropOnZone(e,zone){e.preventDefault();e.stopPropagation();placeCoin(e.dataTransfer.getData('text/coin')||dragging,zone);endDrag();}
  const openTab = (t) => { setTab(t); setOpen(true); };

  return (
    <main className="app">
      <div className="stage" onDragOver={onDragOver} onDrop={onDrop}>
        <Village3D scenario={sceneScenario} base={base} target={target} progressRef={progressRef} coins={coins} hoverZone={hoverZone} dragging={!!dragging} view={view} pickRef={pickRef} onInspect={(item)=>item==='backup-storage'?setStorageOpen(true):setInspected(item)} backup={backupSnapshot} onZoneClick={onZoneClick} weather={weather} />
      </div>
      <div className="vignette" />
      <div className="explore-hint">TRACKPAD · drag to orbit · two-finger scroll to zoom · right-drag / Shift+drag to pan · click a building to enter</div>
      {storageOpen && <BackupStorageModal snapshot={backupSnapshot} onClose={()=>setStorageOpen(false)}/>}
      {inspected && <InteriorModal type={inspected} scenario={sceneScenario} result={mode==='human'?humanResult:mode==='nexus'?nexusResult:null} target={target} onClose={()=>setInspected(null)}/> }

      <header className="topbar">
        <div className="brand"><Logo size={46} /><div><h1>NEXUS</h1><p className="mono gold">VILLAGE · 24H CRISIS SIMULATOR</p></div></div>
        <div className="clock"><b ref={clockRef}>T+ 00:00</b><span className="mono dim">{mode === "idle" ? "SCENARIO READY" : mode === "crisis" ? "CRISIS ONLY" : mode === "human" ? "YOUR DISTRIBUTION" : "NEXUS SOLUTION"}</span><i><u ref={barRef} /></i></div>
        <div className="top-right">
          <div className="seg">{VIEW_BUTTONS.map(([id, label]) => <button key={id} className={view.name === id ? "on" : ""} onClick={() => setView({ name: id, n: view.n + 1 })}>{label}</button>)}</div>
          <span className={`chip mono ${apiStatus}`}><Activity size={13} /> API {apiStatus.toUpperCase()}</span>
        </div>
      </header>

      <div className="hud-left mono nexus-hud">
        <span className="nexus-hud-kicker">FIELD OVERVIEW / TUNISIA</span>
        <h2>{mode==='idle'?'—':sceneScenario.temperature+'°C'}</h2>
        <p>{mode==='idle'?'Awaiting SIMULATE — changes are draft only':`${sceneScenario.grid_status==='OFF'?'Grid blackout':'Grid online'} · ${sceneScenario.pump_operational?'Pump operational':'Pump failure'}`}</p>
        <div className="tokens"><span><i className="coin blue" /> {scenario.water_available} water budget</span><span><i className="coin gold" /> {scenario.energy_available} energy budget</span></div>
      </div>

      <nav className="rail" aria-label="Tools">
        {TABS.map(([id, label, Icon]) => <button key={id} className={open && tab === id ? "on" : ""} onClick={() => (open && tab === id ? setOpen(false) : openTab(id))} title={label}><Icon size={20} /><span className="mono">{label}</span></button>)}
      </nav>

      <button className="backup-shortcut" onClick={()=>setStorageOpen(true)} title="Inspect backup depot in village"><Zap size={15}/> BACKUP STORAGE</button>
      {dragging && <div className="banner mono">DROP THE {dragging.toUpperCase()} COIN ON A ZONE{hoverZone ? ` · ${hoverZone.toUpperCase()}` : ""}</div>}

      <footer className="bottom">
        <div className="chips">{Object.keys(scenarios).map((id) => <button key={id} className={`btn ${scenarioId === id ? "on" : ""}`} onClick={() => selectScenario(id)}>{(scenarioNames[id] || id).toUpperCase()}</button>)}</div>
        <div className="chips">
          <button className="btn" onClick={() => openTab("crisis")}><CloudRain size={15}/> RAIN CAPTURE</button>
          <button className="btn" onClick={() => openTab("distribute")}><Hand size={15} /> DISTRIBUTE TOKENS</button>
          <button className="btn nx" onClick={() => { openTab("nexus"); runNexus(); }} disabled={!!busy}><Bot size={15} /> NEXUS SOLUTION</button>
          <button className="btn go" onClick={runCrisis}><Play size={15} /> SIMULATE CRISIS</button>
        </div>
      </footer>

      <AnimatePresence>
        {open && (
          <motion.aside className="drawer" initial={{ x: "104%" }} animate={{ x: 0 }} exit={{ x: "104%" }} transition={{ type: "spring", damping: 28, stiffness: 240 }}>
            <div className="drawer-head">
              <div><span className="mono dim">NEXUS CONTROL</span><h2>{{ crisis: "Customize the crisis", distribute: "Distribute resources", nexus: "NEXUS recommendation", compare: "Human vs NEXUS" }[tab]}</h2></div>
              <button className="x" onClick={() => setOpen(false)} aria-label="Close panel"><X size={18} /></button>
            </div>
            <div className="tabs">{TABS.map(([id, label]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
            <div className="drawer-body">
              {tab === "crisis" && <>
                <p className="note">Build your custom crisis below. Quick presets are available in the bottom bar, outside this control panel. No visual change occurs until SIMULATE.</p>
                <h3 className="mono gold">ENVIRONMENT</h3>
                <Slider label="Temperature" unit="°C" value={scenario.temperature} min={20} max={60} onChange={(v) => updateScenario("temperature", v)} />
                <Slider label="Wind speed" unit=" m/s" value={scenario.wind_speed} min={0} max={60} onChange={(v) => updateScenario("wind_speed", v)} />
                <Slider label="Pollution" unit="%" value={scenario.pollution} min={0} max={100} onChange={(v) => updateScenario("pollution", v)} />
                <h3 className="mono gold">AVAILABLE RESOURCES</h3>
                <Slider label="Water tokens" value={scenario.water_available} min={0} max={40} onChange={(v) => updateScenario("water_available", v)} />
                <Slider label="Energy tokens" value={scenario.energy_available} min={0} max={40} onChange={(v) => updateScenario("energy_available", v)} />
                <h3 className="mono gold">INFRASTRUCTURE</h3>
                <div className="row"><span>Power grid</span><button className="btn small" onClick={() => updateScenario("grid_status", scenario.grid_status === "ON" ? "OFF" : "ON")}>{scenario.grid_status === "ON" ? "ONLINE" : "BLACKOUT"}</button></div>
                <div className="row"><span>Water pump</span><button className="btn small" onClick={() => updateScenario("pump_operational", !scenario.pump_operational)}>{scenario.pump_operational ? "OPERATIONAL" : "FAILED"}</button></div>
                <section className="weather-panel">
                  <h3 className="mono gold">RAIN MODEL INPUTS (6H HORIZON)</h3>
                  <Slider label="Humidity" unit="%" value={humidity} min={0} max={100} onChange={v=>{setHumidity(v);setForecast(null);setVillageForecast(null);setRainDeployed(false)}} />
                  <label className="field"><span>Sky condition</span><select value={sky} onChange={e=>{setSky(e.target.value);setForecast(null);setVillageForecast(null);setRainDeployed(false)}}><option value="clear">Clear</option><option value="partly cloudy">Partly cloudy</option><option value="cloudy">Cloudy</option></select></label>
                  <label className="field"><span>Hour</span><select value={forecastHour} onChange={e=>{setForecastHour(Number(e.target.value));setForecast(null);setRainDeployed(false)}}>{[0,6,12,18].map(x=><option key={x} value={x}>{String(x).padStart(2,'0')}:00</option>)}</select></label>
                  <label className="field"><span>Month</span><select value={forecastMonth} onChange={e=>{setForecastMonth(Number(e.target.value));setForecast(null);setVillageForecast(null);setRainDeployed(false)}}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
                  <div className="weather-title"><CloudRain size={19}/><b>NEXUS RAIN CAPTURE · HOSPITAL ROOF</b></div>
                  <p className="note">Predict rain using trained backend models. Shield deployment is never automatic: a rain opportunity opens a confirmation proposal.</p>
                  <button className="btn nx wide" onClick={predictWeather} disabled={weatherBusy}><CloudSun size={15}/> {weatherBusy?'CHECKING MODEL...':'PREDICT METEO (BACKEND)'}</button>
                  <Slider label="Demo rainfall (not a prediction)" unit=" mm/24h" value={demoRainfall} min={0} max={45} onChange={setDemoRainfall}/>
                  <button className="btn wide" onClick={useDemoWeather}>LOAD DEMO RAIN EVENT</button>
                  {forecast && <div className="rain-readout">
                    <b>{forecast.label}</b>
                    <span>Rain: {Number(forecast.rainfall_mm).toFixed(1)} mm / {forecast.horizon || 24}h</span>
                    {forecast.probability!==null&&<span>Model rain probability: {(forecast.probability*100).toFixed(0)}%</span>}
                    <span>42 m² collector × 75% efficiency</span>
                    <span>Capture if deployed: {rainLiters(forecast.rainfall_mm).toFixed(0)} L (650 L tank)</span>
                    <span>Droplet impact micro-energy illustration: ~{microEnergyWh(rainLiters(forecast.rainfall_mm)).toFixed(4)} Wh maximum scenario estimate (0 kWh tokens)</span>
                    <span>Water resource unit = 5000 L/token; recovered rain is not automatically added to pumpable water.</span>
                    {eligibleRain(forecast)?<button className="btn go wide" disabled={rainDeployed} onClick={activateRain}><Umbrella size={15}/> {rainDeployed?'COLLECTOR DEPLOYED':'REVIEW / DEPLOY RAIN SHIELD'}</button>:<p className="warn">Not recommended: requires ≥70% forecast probability (or demo event), ≥8 mm rain, and ≥200 L estimated collection.</p>}
                    {rainDeployed && <button className="btn wide" onClick={()=>setRainDeployed(false)}>FOLD RAIN SHIELD</button>}
                  </div>}
                  <p className="note">Separate non-potable rain tank. Animated gold circuit demonstrates a tiny theoretical energy transfer to a hospital indicator, NOT hospital equipment. 0 energy tokens are added.</p>
                  <h3 className="mono gold">TRAINED ML — VILLAGE DEMAND FORECAST</h3>
                  <p className="note">The provided Colab Random Forest models predict reference-village hospital, household and irrigation demand, plus solar generation, in actual m³ / kWh over four 6-hour periods. This is a separate synthetic reference dataset and does NOT overwrite the playable token model.</p>
                  <button className="btn nx wide" disabled={villageBusy} onClick={predictVillage}>{villageBusy?'RUNNING TRAINED MODELS...':'PREDICT 24H VILLAGE NEEDS'}</button>
                  {villageForecast && <section className="result">
                    <h3>Colab ML predictions · reference village</h3>
                    <div className="row"><span>Hospital water</span><b>{villageForecast.totals.hospital_water_m3} m³</b></div>
                    <div className="row"><span>Household water</span><b>{villageForecast.totals.household_water_m3} m³</b></div>
                    <div className="row"><span>Agriculture water</span><b>{villageForecast.totals.agriculture_water_m3} m³</b></div>
                    <div className="row"><span>Solar energy (reference village)</span><b>{villageForecast.totals.solar_energy_kwh} kWh</b></div>
                    <p className="note">Solar estimates and source attribution are shown in the clickable BACKUP STORAGE depot in the 3D village.</p>
                    <button className="btn nx wide" disabled={solarCreditApplied || !backupSnapshot} onClick={applySolarCredit}>{solarCreditApplied?'DEMO SOLAR CREDIT APPLIED':'USE STORED SOLAR (DEMO) — RESIMULATE'}</button>
                    <h3>Model-generated reference risk labels</h3>
                    {Object.entries(villageForecast.risk_labels_reference||{}).map(([k,v])=><div className="row" key={k}><span>{k}</span><b>{v}</b></div>)}
                    <p className="note">{villageForecast.warning}</p>
                  </section>}
                </section>
                <button className="btn go wide" disabled={!!busy} onClick={runCrisis}><Play size={15} /> {busy==='crisis'?'CHECKING CRISIS...':'SIMULATE THIS CRISIS'}</button>
                {crisisPreview && <section className="result"><h3>Backend crisis assessment</h3><p className="note">No resources allocated yet; this is a crisis preview, not a survival score.</p>{Object.entries(crisisPreview.crisis_flags||{}).map(([key,value])=><div className="row" key={key}><span>{key.replaceAll('_',' ')}</span><b>{value?'YES':'NO'}</b></div>)}<div className="row"><span>Max pumpable water if all energy powers pump</span><b>{crisisPreview.resource_limits?.max_pumpable_water_if_all_energy_used_for_pump}</b></div></section>}
                <p className="note">Crisis only shows what happens if nobody intervenes. It is a visual estimate, not a backend score.</p>
              </>}

              {tab === "distribute" && <>
                <p className="note">Drag a coin onto the 3D zone or a zone card below. On touchpad: click a coin, then click a zone in the village. Blue coins placed at the source are <b>reserved</b>, not extra water. Each delivered water coin requires one pump-energy coin.</p>
                <div className="tray">
                  <div className="tray-box"><span className="mono">WATER · {waterTokens}</span><div>{Array.from({ length: Math.min(waterTokens, 10) }).map((_, i) => <button key={i} className={`coin blue big ${selectedCoin==='water'?'selected-coin':''}`} draggable onClick={()=>setSelectedCoin(v=>v==='water'?null:'water')} onDragStart={startDrag("water")} onDragEnd={endDrag} title="Drag or click to select water" />)}</div></div>
                  <div className="tray-box"><span className="mono">ENERGY · {energyTokens}</span><div>{Array.from({ length: Math.min(energyTokens, 10) }).map((_, i) => <button key={i} className={`coin gold big ${selectedCoin==='energy'?'selected-coin':''}`} draggable onClick={()=>setSelectedCoin(v=>v==='energy'?null:'energy')} onDragStart={startDrag("energy")} onDragEnd={endDrag} title="Drag or click to select energy" />)}</div></div>
                </div>
                {ZONES.map((z) => (
                  <div className="zone-block" key={z.id} onDragOver={e=>e.preventDefault()} onDrop={e=>dropOnZone(e,z.id)} onClick={()=>{if(selectedCoin)onZoneClick(z.id)}}>
                    <h3 className="mono gold">{z.title.toUpperCase()}</h3>
                    {z.rows.map(([key, label, kind]) => <div className="row" key={key}><span><i className={`coin ${kind === "water" ? "blue" : "gold"}`} /> {label}</span><Stepper value={allocation[key]} label={`${z.title} ${label}`} onChange={(v) => changeAllocation(key, v)} /></div>)}
                  </div>
                ))}
                <p className="note">Remaining in tray: {waterTokens} blue · {energyTokens} yellow. Reserved at source: {allocation.source_water} blue. You can simulate 0 or 1 token in any zone. Water may remain undelivered when pump energy is missing. NEXUS always uses the original crisis stock ({scenario.water_available} blue / {scenario.energy_available} yellow), not these choices.</p>
                <button className="btn go wide" disabled={!!busy} onClick={runHuman}><Play size={15} /> {busy === "human" ? "SIMULATING..." : "SIMULATE MY DISTRIBUTION"}</button>
                <Result title="Your distribution" result={humanResult} tone="#E8A317" />
              </>}

              {tab === "nexus" && <>
                <div className="intro"><div className="orb"><Bot size={28} /></div><h3>NEXUS OPTIMIZATION ENGINE</h3><p className="note">NEXUS solves the same crisis, places the tokens, and the village shows the impact over 24 hours.</p></div>
                <button className="btn nx wide" disabled={!!busy} onClick={runNexus}><Bot size={15} /> {busy === "nexus" ? "OPTIMIZING..." : "OPTIMIZE WITH NEXUS"}</button>
                {nexusResult?.allocation && <div className="alloc">
                  <h3 className="mono gold">RECOMMENDED TOKENS</h3>
                  {Object.entries(nexusResult.allocation).map(([k, v]) => <div className="row" key={k}><span><i className={`coin ${k.includes("water") ? "blue" : "gold"}`} /> {k.replaceAll("_", " ")}</span><b>{v}</b></div>)}
                </div>}
                <Result title="NEXUS solution" result={nexusResult} tone="#4FA85F" />
                <p className="note">The explanation appears in a typewriter panel beside the 3D village. It uses a live LLM only when OPENAI_API_KEY is configured on the backend; otherwise, backend rules explain the exact optimization without invented facts.</p>
              </>}

              {tab === "compare" && <>
                <div className="intro"><div className="orb"><GitCompareArrows size={26} /></div><h3>HUMAN VS NEXUS</h3><p className="note">Same crisis, two decisions. Run your distribution and the NEXUS solution first.</p></div>
                <button className="btn go wide" disabled={!!busy||!humanResult?.feasible||!nexusResult?.feasible} onClick={runCompare}><GitCompareArrows size={15} /> {busy === "compare" ? "COMPARING..." : "COMPARE BOTH DECISIONS"}</button>
                {compareResult && <section className="result">
                  <h3>{compareResult.comparison_valid === false ? "Comparison not valid" : "Comparison"}</h3>
                  <div className="cmp"><div><span className="mono dim">HUMAN</span><b>{compareResult.human?.resilience_score ?? "—"}</b></div><div><span className="mono dim">NEXUS</span><b>{compareResult.nexus?.resilience_score ?? "—"}</b></div></div>
                  {compareResult.score_difference != null && <div className="reco"><Sparkles size={15} />NEXUS score difference: {compareResult.score_difference > 0 ? "+" : ""}{compareResult.score_difference}</div>}
                  <div className="chips" style={{marginTop:12,flexWrap:'wrap'}}>
                    <button className="btn" onClick={()=>{setMode('human');play();setOpen(false)}}>VIEW HUMAN RESULT IN 3D</button>
                    <button className="btn nx" onClick={()=>{setMode('nexus');play();setOpen(false)}}>VIEW NEXUS RESULT IN 3D</button>
                  </div>
                  {['hospital_water','hospital_energy','household_water','agriculture_water'].map(key=><div className="row" key={key}>
                    <span>{key.replaceAll('_',' ')}</span>
                    <b>Human {compareResult.human.coverage?.[key] ?? 0}% / NEXUS {compareResult.nexus.coverage?.[key] ?? 0}%</b>
                  </div>)}
                  {compareResult.conclusion && <div className="reco"><Lightbulb size={15}/>{compareResult.conclusion}</div>}
                  {compareResult.message && <p className="note">{compareResult.message}</p>}
                </section>}
              </>}

              {error && <p className="err"><AlertTriangle size={15} /> {error}</p>}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {rainSuggestion && !rainDeployed && forecast && <div className="rain-proposal-backdrop">
        <section className="rain-proposal" role="dialog" aria-modal="true" aria-label="Rainwater harvesting recommendation">
          <button className="x" style={{float:'right'}} onClick={()=>setRainSuggestion(false)} aria-label="Dismiss rain recommendation"><X size={18}/></button>
          <CloudRain size={30} color="#68bee7"/><h2>NEXUS RAIN HARVEST OPPORTUNITY</h2>
          <p>{forecast.label}: {Number(forecast.rainfall_mm).toFixed(1)} mm forecast/demonstrated rainfall
            {forecast.probability!==null?` · ${(forecast.probability*100).toFixed(0)}% chance`:''}.</p>
          <p><b>{rainLiters(forecast.rainfall_mm).toFixed(0)} liters</b> potential non-potable collection. Separate tank, not added to original water tokens.</p>
          <p>Droplet impact energy is experimental (~{microEnergyWh(rainLiters(forecast.rainfall_mm)).toFixed(4)} Wh illustrative ceiling); hospital equipment is NOT powered by it.</p>
          <div className="chips"><button className="btn go" onClick={activateRain}>DEPLOY ROOF COLLECTOR</button>
            <button className="btn" onClick={()=>setRainSuggestion(false)}>NOT NOW</button></div>
        </section>
      </div>}
      <NexusNarrator message={narration?.text} engine={narration?.engine} onClose={()=>setNarration(null)}/>
      {toast && <div className="toast mono"><Eye size={13} /> {toast}</div>}
    </main>
  );
}
