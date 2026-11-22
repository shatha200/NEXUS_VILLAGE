"""Final checkpoint regression tests for bad token choices and explanations."""
from fastapi.testclient import TestClient
from main import app

c=TestClient(app)
S={'temperature':50,'water_available':12,'energy_available':8,'grid_status':'OFF','pump_operational':True,'wind_speed':15,'pollution':70}
Z={key:0 for key in ('hospital_water','household_water','agriculture_water','hospital_energy','pump_energy','source_water')}

def effective(s,a):
    r=c.post('/simulate-effective',json={'scenario':s,'allocation':a})
    assert r.status_code==200,r.text
    return r.json()

def test_zero_tokens_are_feasible_and_zero_score():
    r=effective(S,Z)
    assert r['feasible'] and r['resilience_score']==0
    assert not r['shortfalls']

def test_one_water_without_pump_stays_at_source():
    r=effective(S,{**Z,'hospital_water':1})
    assert r['allocation']['hospital_water']==0
    assert r['requested_allocation']['hospital_water']==1
    assert r['shortfalls']['hospital_water']==1
    assert r['remaining_water']==12

def test_water_pump_but_not_hospital_energy():
    r=effective(S,{**Z,'agriculture_water':1,'pump_energy':1})
    assert r['coverage']['agriculture_water']>0
    assert r['coverage']['hospital_water']==0
    assert r['coverage']['hospital_energy']==0

def test_pump_failure_prevents_all_distribution():
    s={**S,'pump_operational':False}
    r=effective(s,{**Z,'hospital_water':1,'pump_energy':1})
    assert r['allocation']['hospital_water']==0
    assert r['allocation']['pump_energy']==0

def test_excess_requested_water_cannot_exceed_budget():
    r=effective({**S,'water_available':1},{**Z,'hospital_water':3,'household_water':2,'pump_energy':5})
    assert r['allocation']['hospital_water']==1
    assert r['allocation']['household_water']==0
    assert r['remaining_water']==0

def test_nexus_ignores_human_choice_and_signature_matches():
    h=effective(S,{**Z,'source_water':12})
    n=c.post('/optimize',json=S).json()
    assert h['scenario_signature']==n['scenario_signature']
    assert n['allocation']['hospital_water']>0
    assert n['resilience_score']>h['resilience_score']

def test_narratives_all_modes_without_key(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    h=effective(S,{**Z,'hospital_water':1})
    n=c.post('/optimize',json=S).json()
    for mode in ('human','nexus','compare'):
        result=c.post('/explain',json={'mode':mode,'scenario':S,'human':h,'nexus':n})
        assert result.status_code==200
        data=result.json()
        assert data['text'] and data['engine']=='rules'
        assert data['llm_active'] is False

def test_cors_for_hackathon_lan():
    r=c.options('/simulate-effective',headers={
        'Origin':'http://192.168.126.1:5173',
        'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'content-type,ngrok-skip-browser-warning'})
    assert r.status_code==200
    assert r.headers['access-control-allow-origin']=='http://192.168.126.1:5173'
