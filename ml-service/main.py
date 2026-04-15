from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pickle
import numpy as np
import json
import os
from datetime import datetime

app = FastAPI(title="Waitless ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model on startup
model = None
metadata = None

@app.on_event("startup")
async def load_model():
    global model, metadata
    model_path = "model/wait_time_model.pkl"
    metadata_path = "model/metadata.json"
    if os.path.exists(model_path):
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        print(f"Model loaded — MAE: {metadata['mae']} min, R²: {metadata['r2']}")
    else:
        print("WARNING: No model found. Run train_model.py first.")

class PredictRequest(BaseModel):
    party_size: int
    tables_occupied: int
    tables_total: int
    queue_length: int
    avg_party_size_ahead: float = 2.5
    hour_of_day: int = None
    day_of_week: int = None

class PredictResponse(BaseModel):
    predicted_wait_minutes: int
    confidence: str
    model_mae: float
    factors: dict

@app.get("/")
def root():
    return {
        "service": "Waitless ML",
        "status": "running",
        "model_loaded": model is not None
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "metadata": metadata
    }

@app.post("/predict", response_model=PredictResponse)
def predict_wait_time(req: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    now = datetime.now()
    hour = req.hour_of_day if req.hour_of_day is not None else now.hour
    day = req.day_of_week if req.day_of_week is not None else now.weekday()

    is_peak = 1 if (13 <= hour <= 15 or 19 <= hour <= 22) else 0
    is_weekend = 1 if day >= 5 else 0
    occupancy_rate = req.tables_occupied / max(req.tables_total, 1)

    features = np.array([[
        hour,
        day,
        req.party_size,
        req.tables_occupied,
        req.tables_total,
        req.queue_length,
        req.avg_party_size_ahead,
        occupancy_rate,
        is_peak,
        is_weekend
    ]])

    prediction = model.predict(features)[0]
    prediction = max(2, round(float(prediction)))

    # Confidence based on occupancy
    if occupancy_rate < 0.3:
        confidence = "high"
    elif occupancy_rate < 0.7:
        confidence = "medium"
    else:
        confidence = "high" if req.queue_length < 5 else "medium"

    factors = {
        "peak_hour": bool(is_peak),
        "weekend": bool(is_weekend),
        "occupancy_rate": round(occupancy_rate * 100, 1),
        "queue_length": req.queue_length,
        "party_size": req.party_size
    }

    return PredictResponse(
        predicted_wait_minutes=prediction,
        confidence=confidence,
        model_mae=metadata['mae'] if metadata else 0,
        factors=factors
    )

@app.get("/model-info")
def model_info():
    if not metadata:
        raise HTTPException(status_code=404, detail="No model loaded")
    return metadata