"""Optional experimental predictions from the supplied NEXUS Colab training artifacts.

Training rows use a *synthetic reference village* (population 3000, farm areas etc.)
with 6-hour demand in m3 and solar production in kWh. THESE VALUES ARE NOT
THE SAME as the tabletop simulator's integer water/energy tokens.
No ML output is silently injected into the token optimization model.
"""
from functools import lru_cache
from pathlib import Path
import os
import math
import joblib
import pandas as pd
import numpy as np
from pydantic import BaseModel, Field
from typing import Literal

DIR = Path(os.environ.get('NEXUS_MODEL_DIR', str(Path(__file__).resolve().parent/'models')))
REG = ('household','clinic','irrigation','solar')
RISKS = ('water','energy','agri')
SKY = {'clear':0,'partly cloudy':1,'cloudy':2}

class VillageForecastInput(BaseModel):
    temperature: float = Field(ge=-10,le=65)
    humidity: float = Field(default=65,ge=0,le=100)
    wind_speed: float = Field(default=4,ge=0,le=200)
    sky: Literal['clear','partly cloudy','cloudy'] = 'cloudy'
    month: int = Field(default=7,ge=1,le=12)
    water_available: int = Field(default=12,ge=0,le=1000)
    energy_available: int = Field(default=8,ge=0,le=1000)
    grid_status: Literal['ON','OFF'] = 'OFF'
    pump_operational: bool = True

@lru_cache(maxsize=1)
def loaded():
    files=[DIR/f'reg_{x}.joblib' for x in REG]+[DIR/f'clf_{x}.joblib' for x in RISKS]+[DIR/'synthetic_sample.csv']
    if not all(f.is_file() for f in files):
        return None
    models={x:joblib.load(DIR/f'reg_{x}.joblib') for x in REG}
    risks={x:joblib.load(DIR/f'clf_{x}.joblib') for x in RISKS}
    samples=pd.read_csv(DIR/'synthetic_sample.csv')
    for name in ['temp','rh','wind','hour']:
        samples[name]=pd.to_numeric(samples[name],errors='coerce')
    samples['month']=pd.to_datetime(samples['time'],errors='coerce').dt.month
    return models,risks,samples

def ready():
    return loaded() is not None

def predict(payload:VillageForecastInput):
    resources=loaded()
    if resources is None:
        raise FileNotFoundError('Village prediction files missing: reg_*.joblib, clf_*.joblib or synthetic_sample.csv')
    models, classifiers, samples = resources
    four=[]
    sky_code=SKY[payload.sky]
    for hour in [0,6,12,18]:
        # Find a plausible example row from the Colab reference dataset;
        # use its context fields (radiation, soil moisture, lagged demands).
        # These are proxies, NOT observed current village conditions.
        sub=samples[(samples.hour==hour)&(samples.month==payload.month)]
        if len(sub)<5:sub=samples[samples.hour==hour]
        distance=((sub.temp-payload.temperature)/12)**2+((sub.rh-payload.humidity)/35)**2+((sub.wind-payload.wind_speed)/8)**2
        base=sub.loc[distance.idxmin()].copy()
        base['temp']=payload.temperature
        base['rh']=payload.humidity
        base['wind']=payload.wind_speed
        base['temp_dm']=float(base.get('temp_dm',payload.temperature)) + (payload.temperature-float(sub.loc[distance.idxmin(),'temp']))*.2
        base['wcode']={'clear':0,'partly cloudy':2,'cloudy':3}[payload.sky]
        def reg(name,crop=None):
            m=models[name]
            row={c:float(base[c]) for c in m.feature_names_in_ if c in base.index}
            if crop is not None:
                row['crop_type']=crop
                row['prev']=float(base[['prev_dem_olive','prev_dem_cereal','prev_dem_veg'][crop]])
            if name=='household':row['prev']=float(base['prev_dem_household'])
            if name=='clinic':row['prev']=float(base['prev_dem_clinic'])
            if name=='solar':row['prev']=float(base['prev_solar'])
            data=pd.DataFrame([row],columns=m.feature_names_in_)
            value=float(m.predict(data)[0])
            if not math.isfinite(value):raise ValueError('Model returned non-finite value')
            return max(0.0,value)
        four.append({'hour':hour,
          'hospital_water_m3':reg('clinic'),
          'household_water_m3':reg('household'),
          'agriculture_water_m3':sum(reg('irrigation',i) for i in range(3)),
          'solar_energy_kwh':reg('solar')})
    totals={k:round(sum(b[k] for b in four),2) for k in ['hospital_water_m3','household_water_m3','agriculture_water_m3','solar_energy_kwh']}
    total_w=totals['hospital_water_m3']+totals['household_water_m3']+totals['agriculture_water_m3']
    # Apply classifer in the same reference-domain units as its training.
    reference=samples.iloc[0]
    rf=pd.DataFrame([{
      'pred_demand_24h':total_w,
      'pred_domestic_24h':totals['hospital_water_m3']+totals['household_water_m3'],
      'reservoir':float(reference['R0']),
      'battery':float(reference['B0']),
      'solar_24h':totals['solar_energy_kwh'],
      'grid_frac':1.0 if payload.grid_status=='ON' else 0.0,
      'pump_capacity':float(reference['pump_cap']) if payload.pump_operational else 0.,
      'inflow_24h':float(reference['rech'])*4,
      'temperature':payload.temperature,
      'soil_moisture':float(reference['sm']),
    }])
    risk={}
    for key,model in classifiers.items():
        p=model.predict(rf[list(model.feature_names_in_)])[0]
        risk[key]=['LOW','MEDIUM','HIGH'][int(p)]
    return {
      'model_source':'provided_colab_joblib',
      'prediction_type':'experimental_synthetic_reference_village',
      'model_ready':True,
      'horizon_hours':24,
      'block_hours':6,
      'blocks':[{k:(round(v,2) if isinstance(v,(float,np.floating)) else v) for k,v in b.items()} for b in four],
      'totals':totals,
      'risk_labels_reference':risk,
      'warning':'Experimental predictions for Colab synthetic reference village (population ~3000); proxy meteorological/soil context from a synthetic sample. NOT calibrated to the tabletop token model and NOT used to alter resource optimization. No measured hospital/patient outcomes.'
    }
