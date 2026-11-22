"""Bounded explanation service. The mathematical engine remains authoritative.
An optional server-side LLM verbalizes the numerical result, never calculates it.
"""
import os
import re
import httpx
from pydantic import BaseModel, Field
from typing import Literal, Optional

LABELS = {
    'hospital_water':'hospital water', 'hospital_energy':'hospital electricity',
    'household_water':'household water', 'agriculture_water':'irrigation'
}

class NarrativeRequest(BaseModel):
    mode: Literal['human','nexus','compare']
    human: Optional[dict] = None
    nexus: Optional[dict] = None
    scenario: dict = Field(default_factory=dict)

def deterministic(req: NarrativeRequest):
    h, n = req.human or {}, req.nexus or {}
    if req.mode == 'human':
        c = h.get('coverage',{})
        a = h.get('effective_allocation') or h.get('allocation',{})
        s = h.get('shortfalls',{})
        words = [f"Your 24-hour decision effectively supplies {a.get('hospital_water',0)} water tokens to the hospital, {a.get('household_water',0)} to households, and {a.get('agriculture_water',0)} to crops."]
        if s: words.append('Some requested coins could not be delivered: '+', '.join(f'{LABELS.get(k,k)} {v}' for k,v in s.items())+'.')
        for key, title in LABELS.items():
            if key in c and c[key]<100: words.append(f'{title.capitalize()} covers {c[key]:.0f}% of modeled demand; this is a service shortage, not a prediction of fatalities.')
        words.append(f"Simulated resilience score: {h.get('resilience_score',0):.1f}/100, under stated policy weights.")
        return ' '.join(words)
    if req.mode == 'nexus':
        a=n.get('allocation',{});c=n.get('coverage',{});s=req.scenario
        text=f"NEXUS uses the original crisis stock of {s.get('water_available','?')} water and {s.get('energy_available','?')} energy tokens, not the human allocation. "
        text+=f"It assigns {a.get('hospital_water',0)} hospital-water, {a.get('household_water',0)} household-water, {a.get('agriculture_water',0)} irrigation, {a.get('hospital_energy',0)} hospital-energy, and {a.get('pump_energy',0)} pump-energy tokens. "
        if s.get('grid_status')=='OFF': text+='Grid electricity is unavailable, so the stated energy budget is assumed to represent usable backup power. '
        for key,title in LABELS.items():
            if c.get(key,100)<100: text+=f'{title.capitalize()} remains at {c[key]:.0f}% coverage. '
        return text+f"The integer optimizer maximizes declared weighted service coverage, resulting in {n.get('resilience_score',0):.1f}/100; it cannot manufacture water or energy."
    hc=h.get('coverage',{});nc=n.get('coverage',{})
    diff=round(n.get('resilience_score',0)-h.get('resilience_score',0),2)
    if diff>0: lead=f'Under the declared weights, NEXUS improves the score by {diff:.2f} points.'
    elif diff<0: lead=f'The human plan scores {-diff:.2f} points higher; check the assumptions and optimization result.'
    else: lead='Both plans have the same weighted score, although their allocations can differ.'
    lines=[lead]
    for key,title in LABELS.items():
        change=nc.get(key,0)-hc.get(key,0)
        if abs(change)>=.1: lines.append(f'{title.capitalize()} changes from {hc.get(key,0):.0f}% to {nc.get(key,0):.0f}% coverage.')
    lines.append('Both results use identical initial crisis resources; neither score predicts actual casualties or guaranteed survival.')
    return ' '.join(lines)

def explain(req: NarrativeRequest):
    base=deterministic(req)
    key=os.getenv('OPENAI_API_KEY','').strip()
    if not key: return {'text':base,'engine':'rules','llm_active':False}
    # Send only numerical simulation summaries, no private user data.
    try:
        payload={
          'model':os.getenv('NEXUS_LLM_MODEL','gpt-4.1-mini'),
          'instructions':('You are a concise, accurate disaster tabletop simulation narrator. '
              'Explain the supplied numeric simulation results, not real-world medical advice. '
              'Do not invent quantities or claim guaranteed safety. 90 words maximum. '
              'Never override the deterministic optimizer. Speak in clear English.'),
          'input':base,
          'max_output_tokens':220,
        }
        with httpx.Client(timeout=12) as client:
            r=client.post('https://api.openai.com/v1/responses',
              headers={'Authorization':f'Bearer {key}','Content-Type':'application/json'},json=payload)
            r.raise_for_status();data=r.json()
        chunks=[]
        for item in data.get('output',[]):
            for part in item.get('content',[]):
                if part.get('type')=='output_text': chunks.append(part.get('text',''))
        answer=' '.join(chunks).strip()
        if not answer: raise ValueError('Empty LLM response')
        return {'text':answer,'engine':'llm','llm_active':True}
    except Exception:
        return {'text':base,'engine':'rules_fallback','llm_active':False}
