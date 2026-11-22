from test_integration import client, S, A

def test_full_frontend_flow_and_visual_hints():
    presets=client.get('/scenarios').json()['scenarios']
    scenario=presets['compound_crisis']
    preview=client.post('/crisis-preview',json=scenario).json()
    assert set(preview['visual_metrics'])=={'hospital','homes','agri','tank','pump','irrigate'}
    human=client.post('/simulate',json={'scenario':scenario,'allocation':A}).json()
    nexus=client.post('/optimize',json=scenario).json()
    assert human['scenario_signature']==nexus['scenario_signature']==preview['scenario_signature']
    for result in (human,nexus):
        assert result['feasible']
        assert set(result['sector_status'])=={'hospital','households','agriculture','reservoir'}
        assert 0<=result['resilience_score']<=100
        assert len(result['explanation'])>=1
    assert sum(nexus['allocation'][k] for k in ['hospital_water','household_water','agriculture_water'])<=nexus['allocation']['pump_energy']
