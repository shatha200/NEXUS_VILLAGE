"""Adapter for the actual trained rain models exported from NEXUS_24-2.ipynb.

The notebook's rain model was trained on (temp, rh, wind [m/s], hour [0/6/12/18],
month, sky [0 clear/1 partly cloudy/2 cloudy]) and predicts a SIX-hour
rain probability and conditional rain quantity. The API deliberately does not
misrepresent this as a 24-hour forecast.
"""
from pathlib import Path
import os
import math
from functools import lru_cache
from typing import Literal

import joblib
import pandas as pd
from pydantic import BaseModel, Field

MODEL_DIR = Path(os.getenv("NEXUS_MODEL_DIR", str(Path(__file__).resolve().parent / "models")))
FEATURES = ["temp", "rh", "wind", "hour", "month", "sky"]
SKY = {"clear": 0, "partly cloudy": 1, "cloudy": 2}

class WeatherInput(BaseModel):
    temperature: float = Field(ge=-30, le=65)
    humidity: float = Field(ge=0, le=100)
    wind_speed: float = Field(ge=0, le=200)  # frontend scenario is m/s
    sky: Literal["clear", "partly cloudy", "cloudy"] = "cloudy"
    hour: int = Field(default=12, ge=0, le=23)
    month: int = Field(default=7, ge=1, le=12)

@lru_cache(maxsize=1)
def load_rain_models():
    classifier = MODEL_DIR / "rain_classifier.joblib"
    amount = MODEL_DIR / "rain_amount.joblib"
    if not (classifier.is_file() and amount.is_file()):
        return None
    return joblib.load(classifier), joblib.load(amount)

def status():
    names = ("rain_classifier.joblib", "rain_amount.joblib")
    exists = [bool((MODEL_DIR / name).is_file()) for name in names]
    return {
        "rain_model_ready": all(exists),
        "files_present": dict(zip(names, exists)),
        "model_origin": "NEXUS_24-2.ipynb; learned from historical weather and synthetic simulation labels",
        "six_hour_horizon": True,
        "model_dir": str(MODEL_DIR),
        "note": "Notebook artifacts must be exported after Colab training; a notebook alone is not a fitted model.",
    }

def predict(w: WeatherInput):
    models = load_rain_models()
    if models is None:
        raise FileNotFoundError("Trained rain models missing. Export nexus24_outputs.zip from the Colab notebook and run install_models.py. You can still use Demo Rain Event.")
    classifier, amount = models
    frame = pd.DataFrame([{
        "temp": w.temperature, "rh": w.humidity, "wind": w.wind_speed,
        "hour": 6 * (w.hour // 6), "month": w.month, "sky": SKY[w.sky],
    }])[FEATURES]
    proba = classifier.predict_proba(frame)
    classes = list(classifier.classes_)
    if 1 not in classes:
        raise ValueError("Loaded model is not a binary rain classifier (missing class 1)")
    probability = float(proba[0][classes.index(1)])
    conditional_mm = max(0.0, float(amount.predict(frame)[0]))
    if not (math.isfinite(probability) and math.isfinite(conditional_mm)):
        raise ValueError("Weather model returned invalid numbers")
    probability = max(0.0, min(1.0, probability))
    return {
        "rain_probability": round(probability, 4),
        "precipitation_mm_6h_expected": round(probability * conditional_mm, 3),
        "rainfall_mm": round(probability * conditional_mm, 3),
        "conditional_rainfall_mm_6h": round(conditional_mm, 3),
        "horizon_hours": 6,
        "model_name": "nexus-colab-rain-random-forest",
        "source": "trained-model",
        "warning": "Statistical forecast for one 6-hour block. Inputs are user-specified conditions, not a live meteorological feed.",
    }
