"""NEXUS VILLAGE: honest 24-hour tabletop crisis model.

All quantities are illustrative and represented by INTEGER tokens:
  water token = 5 m³; energy token = 1 kWh.
  Delivering one water token consumes one pump-energy token.

This is not a real-world emergency operations or medical forecasting system.
"""
from __future__ import annotations

from typing import Literal
import hashlib
import json
import os

from fastapi import HTTPException

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from scipy.optimize import linprog

app = FastAPI(title="NEXUS VILLAGE", version="1.0.0", description="24-hour village crisis resource simulation and optimization")
app.add_middleware(
    CORSMiddleware,
    # Development configuration: permit requests from the local frontend and
    # temporary preview URLs. Credentials are disabled, so wildcard origins are
    # supported by Starlette's CORS middleware.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Priority weights (policy assumptions, not field-validated outcomes).
WEIGHTS = {
    "hospital_water": 35.0,
    "hospital_energy": 35.0,
    "household_water": 20.0,
    "agriculture_water": 10.0,
}
ALLOC_KEYS = ("hospital_water", "household_water", "agriculture_water", "hospital_energy", "pump_energy")


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    temperature: float = Field(default=50, ge=-10, le=65, description="Degrees Celsius")
    water_available: int = Field(default=12, ge=0, le=1000, description="Available blue water tokens")
    energy_available: int = Field(default=8, ge=0, le=1000, description="USABLE yellow energy tokens, including backup after grid status")
    grid_status: Literal["ON", "OFF"] = "OFF"
    pump_operational: bool = True
    wind_speed: float = Field(default=0, ge=0, le=200, description="m/s; display-only in MVP")
    pollution: float = Field(default=0, ge=0, le=100, description="demo index; display-only in MVP")


class Allocation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hospital_water: int = Field(default=0, ge=0)
    household_water: int = Field(default=0, ge=0)
    agriculture_water: int = Field(default=0, ge=0)
    hospital_energy: int = Field(default=0, ge=0)
    pump_energy: int = Field(default=0, ge=0)
    # Optional physical token allocation: reserved at the source, NOT consumed or delivered.
    source_water: int = Field(default=0, ge=0)


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario: Scenario
    allocation: Allocation


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario: Scenario
    allocation: Allocation


PRESETS: dict[str, dict] = {
    "moderate": {
        "temperature": 38, "water_available": 18, "energy_available": 22,
        "grid_status": "ON", "pump_operational": True, "wind_speed": 10, "pollution": 25,
    },
    "heatwave": {
        "temperature": 45, "water_available": 14, "energy_available": 12,
        "grid_status": "ON", "pump_operational": True, "wind_speed": 5, "pollution": 40,
    },
    "compound_crisis": {
        "temperature": 50, "water_available": 12, "energy_available": 8,
        "grid_status": "OFF", "pump_operational": True, "wind_speed": 15, "pollution": 70,
    },
    "water_shortage": {
        "temperature": 42, "water_available": 6, "energy_available": 18,
        "grid_status": "ON", "pump_operational": True, "wind_speed": 8, "pollution": 30,
    },
    "pump_failure": {
        "temperature": 46, "water_available": 12, "energy_available": 15,
        "grid_status": "ON", "pump_operational": False, "wind_speed": 12, "pollution": 30,
    },
}


def scenario_signature(s: Scenario) -> str:
    """Stable short identifier. The frontend checks both paths used the same scenario."""
    blob = json.dumps(s.model_dump(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def demands_for(s: Scenario) -> dict[str, int]:
    # Illustrative 24-hour demand model. No measured Tunisian data implied.
    if s.temperature >= 45:
        household, agriculture = 5, 8
    elif s.temperature >= 40:
        household, agriculture = 4, 7
    else:
        household, agriculture = 4, 6
    return {
        "hospital_water": 3,
        "household_water": household,
        "agriculture_water": agriculture,
        "hospital_energy": 4,
    }


def validate_allocation(s: Scenario, a: Allocation, demands: dict[str, int]) -> list[str]:
    issues: list[str] = []
    water = a.hospital_water + a.household_water + a.agriculture_water
    energy = a.hospital_energy + a.pump_energy
    if water + a.source_water > s.water_available:
        issues.append(f"Water assigned: {water} delivered + {a.source_water} reserved at source; available: {s.water_available} tokens.")
    if energy > s.energy_available:
        issues.append(f"Energy requested: {energy}; available: {s.energy_available} tokens.")
    if water > a.pump_energy:
        issues.append(f"Insufficient pumping energy: {water} water tokens require at least {water} pump-energy tokens; allocated {a.pump_energy}.")
    if not s.pump_operational and water > 0:
        issues.append("Pump has failed: no pumped water can be delivered.")
    if not s.pump_operational and a.pump_energy > 0:
        issues.append("Pump has failed: allocating energy to the pump is not operationally possible.")
    for sector, demand in demands.items():
        allocated = getattr(a, sector)
        if allocated > demand:
            issues.append(f"{sector} allocation {allocated} exceeds demand {demand}.")
    return issues


def visual_state(percent: float) -> str:
    if percent >= 80:
        return "healthy"
    if percent >= 50:
        return "stressed"
    return "critical"


def explain(s: Scenario, a: Allocation, demands: dict[str, int], coverage: dict[str, float]) -> list[str]:
    notes: list[str] = []
    if a.source_water > 0:
        notes.append(f"{a.source_water} blue token(s) intentionally reserved at the source; these are not additional water supply.")
    if s.grid_status == "OFF":
        notes.append("Grid blackout: available energy is assumed to come from usable backup sources.")
    if not s.pump_operational:
        notes.append("The pump is unavailable, so piped water delivery is zero in this simplified model.")
    if coverage["hospital_water"] < 100 or coverage["hospital_energy"] < 100:
        notes.append("Hospital essential services are not fully covered; the village remains in a critical condition.")
    else:
        notes.append("Hospital water and electricity demand are fully covered.")
    if coverage["household_water"] < 100:
        notes.append("Household water demand is not fully met.")
    if coverage["agriculture_water"] < 100:
        notes.append("Agricultural irrigation has been curtailed to conserve resources.")
    if s.wind_speed or s.pollution:
        notes.append("Wind and pollution are displayed as scenario context; they do not change MVP optimization results.")
    notes.append("All scores are illustrative service-coverage metrics, not predictions of casualties or actual survival.")
    return notes


def evaluate(s: Scenario, a: Allocation) -> dict:
    demands = demands_for(s)
    issues = validate_allocation(s, a, demands)
    if issues:
        return {"scenario_signature": scenario_signature(s), "feasible": False, "violations": issues, "demands": demands, "allocation": a.model_dump(), "resilience_score": None}

    values = a.model_dump()
    coverage = {name: round(100 * values[name] / demand, 2) for name, demand in demands.items()}
    score = round(sum(WEIGHTS[name] * (values[name] / demands[name]) for name in WEIGHTS), 2)
    water_used = a.hospital_water + a.household_water + a.agriculture_water
    energy_used = a.hospital_energy + a.pump_energy

    # Hospital functioning requires BOTH water and electricity.
    hospital_combined = min(coverage["hospital_water"], coverage["hospital_energy"])
    return {
        "scenario_signature": scenario_signature(s),
        "feasible": True,
        "violations": [],
        "allocation": values,
        "demands": demands,
        "coverage": coverage,
        "resilience_score": score,
        "remaining_water": s.water_available - water_used,
        "remaining_energy": s.energy_available - energy_used,
        "hospital_combined_coverage": hospital_combined,
        "sector_status": {
            "hospital": visual_state(hospital_combined),
            "households": visual_state(coverage["household_water"]),
            "agriculture": visual_state(coverage["agriculture_water"]),
            "reservoir": visual_state(100 * (s.water_available - water_used) / max(s.water_available, 1)),
        },
        "explanation": explain(s, a, demands, coverage),
        "disclaimer": "Aggregate 24h tabletop simulation; assumed token units and policy weights; not operational emergency advice.",
    }


def optimize_allocation(s: Scenario) -> dict:
    demands = demands_for(s)
    # MAX weighted coverage => MIN negative weighted coverage.
    c = [-WEIGHTS["hospital_water"] / demands["hospital_water"],
         -WEIGHTS["household_water"] / demands["household_water"],
         -WEIGHTS["agriculture_water"] / demands["agriculture_water"],
         -WEIGHTS["hospital_energy"] / demands["hospital_energy"],
         0.0]
    # Order: hospital_water, household_water, agriculture_water, hospital_energy, pump_energy.
    A_ub = [[1, 1, 1, 0, 0],     # water store
            [0, 0, 0, 1, 1],     # usable energy
            [1, 1, 1, 0, -1]]    # energy required to pump allocated water
    b_ub = [s.water_available, s.energy_available, 0]
    pump_max = s.energy_available if s.pump_operational else 0
    bounds = [(0, demands["hospital_water"]),
              (0, demands["household_water"]),
              (0, demands["agriculture_water"]),
              (0, demands["hospital_energy"]),
              (0, pump_max)]

    # Integer optimization ensures outputs match whole physical bottle-cap tokens.
    # Requires SciPy >= 1.9 (linprog HiGHS integrality).
    solution = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds,
                       integrality=[1, 1, 1, 1, 1], method="highs")
    if not solution.success or solution.x is None:
        raise RuntimeError(f"Optimization failed: {solution.message}")
    rounded = [int(round(float(x))) for x in solution.x]
    a = Allocation(**dict(zip(ALLOC_KEYS, rounded)))
    result = evaluate(s, a)
    if not result["feasible"]:
        raise RuntimeError("Internal optimizer error: generated an infeasible plan")
    result["method"] = "integer_linear_programming_highs"
    result["policy_weights"] = WEIGHTS
    result["recommendation"] = "Maximize declared weighted service coverage using the original crisis water/energy budgets, independently of the manual decision."
    result["actions"] = recommendation_actions(s, result)
    return result


def recommendation_actions(s: Scenario, result: dict) -> list[dict]:
    """Explain implemented allocation decisions only; no fictional extra resources."""
    allocation = result["allocation"]
    coverage = result["coverage"]
    actions = []
    if s.grid_status == "OFF":
        actions.append({"id": "backup_energy", "label": "Use available backup electricity", "detail": "The usable energy budget already includes assumed backup supply.", "simulated": True})
    if allocation["hospital_energy"] > 0:
        actions.append({"id": "hospital_power", "label": "Supply hospital electricity", "detail": f"Assign {allocation['hospital_energy']} energy tokens to the hospital.", "simulated": True})
    if allocation["pump_energy"] > 0:
        actions.append({"id": "pump", "label": "Power the pump", "detail": f"Assign {allocation['pump_energy']} energy tokens to move {sum(allocation[k] for k in ('hospital_water','household_water','agriculture_water'))} water tokens.", "simulated": True})
    if coverage["agriculture_water"] < 100:
        actions.append({"id": "limit_irrigation", "label": "Temporarily reduce irrigation", "detail": "Agricultural demand is not fully met in this 24-hour window.", "simulated": True})
    if coverage["household_water"] < 100:
        actions.append({"id": "households_shortage", "label": "Flag household water shortage", "detail": "Household water demand remains partly unmet.", "simulated": True})
    return actions


@app.get("/health")
def health():
    return {"status": "ok", "project": "NEXUS VILLAGE"}


@app.get("/scenarios")
def get_scenarios():
    return {"scenarios": PRESETS, "units": {"water_token_m3": 5, "energy_token_kwh": 1, "pump_kwh_per_water_token": 1},
            "notes": "energy_available is usable power after outages, including backup. Wind and pollution are display-only."}


def crisis_visual_metrics(s: Scenario) -> dict[str, float | bool]:
    """Stress *potential*, not a simulated allocation or a mortality estimate.

    Explicitly reflects water and pump scarcity, heat, and grid/backup limitations.
    Flow animations remain OFF until an actual feasible allocation is simulated.
    """
    def clip(v: float) -> float:
        return max(0.0, min(1.0, v))

    d = demands_for(s)
    heat = clip((s.temperature - 30) / 25)
    pump_capacity = min(s.water_available, s.energy_available) if s.pump_operational else 0
    # This is an optimistic capacity bound, NOT a decision or a forecasted delivery.
    hospital_potential = min(1.0, pump_capacity / d['hospital_water'],
                             s.energy_available / (d['hospital_energy'] + d['hospital_water']))
    household_potential = clip(pump_capacity / d['household_water'])
    crop_potential = clip(pump_capacity / d['agriculture_water'])
    return {
        'hospital': round(clip(hospital_potential * (1 - heat * .12)), 3),
        'homes': round(clip(household_potential * (1 - heat * .16)), 3),
        'agri': round(clip(crop_potential * (1 - heat * .26)), 3),
        'tank': round(clip(s.water_available / 25), 3),
        'pump': bool(s.pump_operational and s.energy_available > 0),
        'irrigate': False,
    }

@app.post("/crisis-preview")
def crisis_preview(scenario: Scenario):
    """Initial crisis context only: no allocation, optimizer or fake 24h outcome."""
    demands = demands_for(scenario)
    total_water_demand = (demands["hospital_water"] + demands["household_water"] + demands["agriculture_water"])
    pump_capacity = scenario.energy_available if scenario.pump_operational else 0
    # Hospital energy and pump energy compete for the same available budget.
    return {
        "scenario": scenario.model_dump(),
        "scenario_signature": scenario_signature(scenario),
        "demands": demands,
        "resource_limits": {
            "water_available": scenario.water_available,
            "energy_available": scenario.energy_available,
            "max_pumpable_water_if_all_energy_used_for_pump": min(scenario.water_available, pump_capacity),
        },
        "crisis_flags": {
            "extreme_heat": scenario.temperature >= 45,
            "grid_blackout": scenario.grid_status == "OFF",
            "pump_failure": not scenario.pump_operational,
            "water_shortage_vs_demand": scenario.water_available < total_water_demand,
            "energy_shortage_vs_full_demand": scenario.energy_available < total_water_demand + demands["hospital_energy"],
        },
        "visual_hints": {
            "heat": "extreme" if scenario.temperature >= 45 else "high" if scenario.temperature >= 40 else "moderate",
            "grid": "off" if scenario.grid_status == "OFF" else "on",
            "pump": "failed" if not scenario.pump_operational else "available",
        },
        # Explicit rule-based crisis-preview visualization, NOT a trained mortality forecast.
        "visual_metrics": crisis_visual_metrics(scenario),
        "note": "Crisis preview before allocation; no survival score or allocation outcome is predicted.",
    }


@app.post("/simulate")
def simulate(req: SimulationRequest):
    return evaluate(req.scenario, req.allocation)



@app.post("/simulate-effective")
def simulate_effective(req: SimulationRequest):
    """Playable human decisions: 0/1/excess water with insufficient pumping are
    simulated as attempted actions, not falsely counted as delivered water.
    Original requested allocation and all shortfalls remain visible.
    """
    s, a = req.scenario, req.allocation
    d = demands_for(s)
    # Preserve water reserved at source, and never create extra usable supply.
    reserve = min(a.source_water, s.water_available)
    water_budget = max(0, s.water_available - reserve)
    # Hospital energy draws first from available energy. The remaining budget can pump.
    hospital_energy = min(a.hospital_energy, d['hospital_energy'], s.energy_available)
    energy_left = max(0, s.energy_available - hospital_energy)
    pump_energy = min(a.pump_energy, energy_left) if s.pump_operational else 0
    deliverable = min(pump_energy, water_budget)
    values = {}
    for key in ('hospital_water', 'household_water', 'agriculture_water'):
        amount = min(getattr(a, key), d[key], deliverable)
        values[key] = max(0, amount)
        deliverable -= amount
    effective = Allocation(**values, hospital_energy=hospital_energy,
                           pump_energy=pump_energy, source_water=reserve)
    outcome = evaluate(s, effective)
    if not outcome['feasible']:
        raise HTTPException(status_code=500,detail='Internal simulation accounting error')
    requested = a.model_dump()
    shortfalls = {key: requested[key] - effective.model_dump()[key]
                  for key in requested if requested[key] > effective.model_dump()[key]}
    outcome.update({
        'requested_allocation': requested,
        'effective_allocation': effective.model_dump(),
        'shortfalls': shortfalls,
        'simulation_mode': 'effective_delivered_tokens',
        'note': 'Requested tokens may not be physically deliverable; only effective allocation affects village visuals.',
    })
    if shortfalls:
        outcome['explanation'] = [
            'Physical constraint correction: not every requested token can be delivered. '
            'Hospital electricity is supplied first; remaining usable pump power then '
            'delivers water to hospital, households and agriculture in that order.'
        ] + outcome['explanation']
    return outcome

@app.post("/optimize")
def optimize(scenario: Scenario):
    return optimize_allocation(scenario)


@app.post("/compare")
def compare(req: CompareRequest):
    human = evaluate(req.scenario, req.allocation)
    nexus = optimize_allocation(req.scenario)
    return {
        "scenario": req.scenario.model_dump(),
        "scenario_signature": scenario_signature(req.scenario),
        "human": human,
        "nexus": nexus,
        "score_difference": round(nexus["resilience_score"] - human["resilience_score"], 2) if human["feasible"] else None,
        "comparison_valid": bool(human["feasible"]),
        "message": "Both decisions use the same scenario and score formula." if human["feasible"] else "Human allocation is infeasible. Correct it before comparing scores.",
    }

# Colab model integration: attached notebook trains these two rain estimators.
# If its joblib exports are absent the endpoint returns an explicit 503,
# NOT a made-up "forecast".
from model_bridge import WeatherInput, predict as predict_trained_rain, status as weather_model_status

@app.get('/model-status')
def get_model_status():
    return weather_model_status()

@app.post('/predict-weather')
def predict_weather(payload: WeatherInput):
    try:
        return predict_trained_rain(payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f'Weather model inference error: {e}')

# Additional prediction models provided in the Colab export. They predict
# demand/solar for a separate synthetic reference village, not token allocations.
from village_models import VillageForecastInput, predict as predict_village_models, ready as village_models_ready

@app.get('/model-status-full')
def model_status_full():
    return {**weather_model_status(), 'village_models_ready': village_models_ready()}

@app.post('/predict-village')
def predict_village(payload: VillageForecastInput):
    try:
        return predict_village_models(payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f'Village model inference error: {e}')

# Optional LLM narrative. The model explains an already-computed solution;
# it never generates allocation numbers or alters the SciPy optimizer.
from narrative import NarrativeRequest, explain as describe_decision

@app.post('/explain')
def explain_endpoint(payload: NarrativeRequest):
    return describe_decision(payload)

@app.get('/narrative-status')
def narrative_status():
    return {'llm_configured':bool(os.getenv('OPENAI_API_KEY')),
            'mode':'llm_if_configured_else_deterministic',
            'notice':'An LLM key is optional. Without it all text is scenario-specific rule-based explanation.'}
