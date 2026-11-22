import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app
from model_bridge import WeatherInput, predict, status

client=TestClient(app)
S={"temperature":50,"water_available":12,"energy_available":8,"grid_status":"OFF","pump_operational":True,"wind_speed":15,"pollution":70}
A={"hospital_water":1,"household_water":2,"agriculture_water":1,"hospital_energy":4,"pump_energy":4}

def test_health_and_presets():
    assert client.get('/health').status_code==200
    p=client.get('/scenarios').json()['scenarios']
    assert len(p)>=5
    assert p['compound_crisis']['grid_status']=='OFF'

def test_backend_preview_and_independent_decisions():
    preview=client.post('/crisis-preview',json=S)
    assert preview.status_code==200
    assert preview.json()['crisis_flags']['grid_blackout']
    human=client.post('/simulate',json={'scenario':S,'allocation':A})
    nexus=client.post('/optimize',json=S)
    assert human.status_code==200 and nexus.status_code==200
    h,n=human.json(),nexus.json()
    assert h['feasible'] and n['feasible']
    assert h['scenario_signature']==n['scenario_signature']
    assert n['resilience_score']>=h['resilience_score']
    assert n['allocation']['hospital_water']==3
    assert sum(n['allocation'][k] for k in ('hospital_water','household_water','agriculture_water'))<=n['allocation']['pump_energy']

def test_human_validation():
    bad=dict(A,pump_energy=1)
    r=client.post('/simulate',json={'scenario':S,'allocation':bad}).json()
    assert not r['feasible']
    assert any('pump' in x.lower() for x in r['violations'])

def test_pump_failure():
    s=dict(S,pump_operational=False)
    result=client.post('/optimize',json=s).json()
    assert result['feasible']
    assert result['allocation']['pump_energy']==0
    assert result['allocation']['hospital_water']==0

def test_zero_resources():
    s=dict(S,water_available=0,energy_available=0)
    n=client.post('/optimize',json=s).json()
    assert n['feasible'] and n['resilience_score']==0

def test_compare_legacy():
    r=client.post('/compare',json={'scenario':S,'allocation':A})
    assert r.status_code==200 and r.json()['comparison_valid']

def test_weather_model_status_and_missing_artifacts():
    data=client.get('/model-status').json()
    assert 'rain_model_ready' in data
    resp=client.post('/predict-weather',json={'temperature':32,'humidity':78,'wind_speed':3,'sky':'cloudy','hour':12,'month':11})
    assert resp.status_code in (200,503)
    if data['rain_model_ready']:
        assert resp.status_code==200
        out=resp.json()
        assert out['horizon_hours']==6
        assert 0<=out['rain_probability']<=1
    else:
        assert resp.status_code==503
        assert 'missing' in resp.json()['detail'].lower()

def test_weather_request_validation():
    r=client.post('/predict-weather',json={'temperature':20,'humidity':150,'sky':'banana'})
    assert r.status_code==422

def test_inputs_strict():
    r=client.post('/simulate',json={'scenario':dict(S,unknown=3),'allocation':A})
    assert r.status_code==422

def test_trained_weather_inference_with_temporary_models(tmp_path, monkeypatch):
    """Tests inference contract with actual fitted sklearn estimators, not shipped fake artifacts."""
    import numpy as np
    import pandas as pd
    import joblib
    import model_bridge
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    rng=np.random.default_rng(7)
    x=pd.DataFrame({
       'temp':rng.uniform(6,45,70), 'rh':rng.uniform(10,99,70),
       'wind':rng.uniform(0,15,70),'hour':rng.choice([0,6,12,18],70),
       'month':rng.integers(1,13,70),'sky':rng.integers(0,3,70)
    })
    y=(x['rh']>55).astype(int)
    clf=RandomForestClassifier(n_estimators=8,random_state=7).fit(x,y)
    reg=RandomForestRegressor(n_estimators=8,random_state=7).fit(x,2+x['rh']/40)
    joblib.dump(clf,tmp_path/'rain_classifier.joblib')
    joblib.dump(reg,tmp_path/'rain_amount.joblib')
    monkeypatch.setattr(model_bridge,'MODEL_DIR',tmp_path)
    model_bridge.load_rain_models.cache_clear()
    try:
        r=client.post('/predict-weather',json={'temperature':22,'humidity':70,'wind_speed':2.5,'sky':'cloudy','hour':15,'month':4})
        assert r.status_code==200, r.text
        d=r.json()
        assert d['source']=='trained-model'
        assert d['horizon_hours']==6
        assert 0<=d['rain_probability']<=1
        assert d['rainfall_mm']>=0
    finally:
        model_bridge.load_rain_models.cache_clear()


def test_uploaded_real_trained_models_are_available():
    assert client.get('/model-status-full').status_code == 200
    status = client.get('/model-status-full').json()
    # Optional in a source-only checkout; true for this delivered full bundle.
    if status['rain_model_ready']:
        r=client.post('/predict-weather',json={'temperature':25,'humidity':85,'wind_speed':2,'sky':'cloudy','hour':12,'month':11})
        assert r.status_code==200, r.text
        assert r.json()['source']=='trained-model'
    if status['village_models_ready']:
        r=client.post('/predict-village',json={**S,'humidity':65,'sky':'cloudy','month':7})
        assert r.status_code==200, r.text
        data=r.json()
        assert data['model_ready'] and len(data['blocks'])==4
        assert data['totals']['household_water_m3']>=0
        assert data['horizon_hours']==24

def test_independent_decisions_are_comparable_by_signature():
    a=client.post('/simulate',json={'scenario':S,'allocation':A}).json()
    b=client.post('/optimize',json=S).json()
    assert a['scenario_signature']==b['scenario_signature']
    different=client.post('/optimize',json={**S,'temperature':42}).json()
    assert a['scenario_signature']!=different['scenario_signature']
