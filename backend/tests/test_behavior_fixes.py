"""Critical user-facing behavior checks for V6."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app

client=TestClient(app)
SCENARIO={"temperature":50,"water_available":12,"energy_available":8,"grid_status":"OFF","pump_operational":True,"wind_speed":15,"pollution":70}
ZERO={"hospital_water":0,"household_water":0,"agriculture_water":0,"hospital_energy":0,"pump_energy":0}

def test_water_reserved_at_source_is_not_delivered():
    r=client.post('/simulate',json={'scenario':SCENARIO,'allocation':{**ZERO,'source_water':6}})
    assert r.status_code==200,r.text
    x=r.json()
    assert x['feasible'] and x['remaining_water']==12
    assert x['coverage']['hospital_water']==0
    assert 'reserved' in ' '.join(x['explanation']).lower()

def test_source_reserve_plus_deliveries_must_not_exceed_stock():
    r=client.post('/simulate',json={'scenario':SCENARIO,'allocation':{**ZERO,'source_water':11,'hospital_water':2,'pump_energy':2}}).json()
    assert not r['feasible']
    assert 'reserved' in ' '.join(r['violations']).lower()

def test_optimizer_uses_scenario_not_human_distribution():
    a=client.post('/optimize',json=SCENARIO).json()
    client.post('/simulate',json={'scenario':SCENARIO,'allocation':{**ZERO,'source_water':12}})
    b=client.post('/optimize',json=SCENARIO).json()
    assert a['allocation']==b['allocation']
    assert a['resilience_score']==b['resilience_score']
    assert b['allocation']['hospital_water']>0

def test_preview_water_energy_pump_failure_affect_risk():
    normal=client.post('/crisis-preview',json={**SCENARIO,'water_available':20,'energy_available':20,'grid_status':'ON'}).json()
    no_water=client.post('/crisis-preview',json={**SCENARIO,'water_available':0}).json()
    no_energy=client.post('/crisis-preview',json={**SCENARIO,'energy_available':0}).json()
    broken=client.post('/crisis-preview',json={**SCENARIO,'pump_operational':False}).json()
    assert normal['visual_metrics']['agri']>no_water['visual_metrics']['agri']
    assert normal['visual_metrics']['hospital']>no_energy['visual_metrics']['hospital']
    assert broken['visual_metrics']['agri']==0
    assert no_water['visual_metrics']['homes']==0

def test_cors_192_origin():
    r=client.options('/health',headers={'Origin':'http://192.168.126.1:5173','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'ngrok-skip-browser-warning'})
    assert r.status_code==200,r.text
    assert r.headers.get('access-control-allow-origin')=='http://192.168.126.1:5173'
