"""ml-service — микросервис классификации задач (IT-заявок) по тексту.

Загружает из MLflow Model Registry модель с алиасом champion и отдаёт
предсказания категории. После выпуска новой модели конвейер Jenkins
вызывает POST /api/ml/reload.
"""
import os
import socket
import threading
import time

import mlflow
from flask import Flask, jsonify, request
from mlflow.tracking import MlflowClient

MODEL_NAME = os.getenv("MODEL_NAME", "ticket-classifier")
mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000"))

app = Flask(__name__)
state = {"model": None, "version": None, "tags": {}, "error": "модель ещё не загружена"}
lock = threading.Lock()


def load_champion():
    try:
        mv = MlflowClient().get_model_version_by_alias(MODEL_NAME, "champion")
        model = mlflow.sklearn.load_model(f"models:/{MODEL_NAME}@champion")
        with lock:
            state.update(model=model, version=mv.version, tags=mv.tags, error=None)
        print(f"Загружена модель {MODEL_NAME} v{mv.version}", flush=True)
    except Exception as e:  # модели ещё нет или MLflow недоступен
        state["error"] = f"модель не обучена или MLflow недоступен: {e.__class__.__name__}"
        print(state["error"], flush=True)


def load_in_background():
    for _ in range(30):
        load_champion()
        if state["model"] is not None:
            return
        time.sleep(10)


@app.get("/api/ml/health")
def health():
    return jsonify(status="ok", service="ml-service", pod=socket.gethostname(),
                   model_version=state["version"])


@app.get("/api/ml/model")
def model_info():
    return jsonify(name=MODEL_NAME, version=state["version"], tags=state["tags"], error=state["error"])


@app.post("/api/ml/predict")
def predict():
    text = (request.get_json(silent=True) or {}).get("text", "").strip()
    if not text:
        return jsonify(error="text is required"), 400
    with lock:
        model = state["model"]
    if model is None:
        return jsonify(error=state["error"]), 503
    proba = model.predict_proba([text.lower()])[0]
    top = sorted(zip(model.classes_, proba), key=lambda x: -x[1])[:3]
    return jsonify(category=top[0][0], model_version=state["version"],
                   top=[{"category": c, "probability": round(float(p), 3)} for c, p in top])


@app.post("/api/ml/reload")
def reload():
    load_champion()
    return jsonify(version=state["version"], error=state["error"]), (200 if state["model"] else 503)


threading.Thread(target=load_in_background, daemon=True).start()

if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=int(os.getenv("PORT", "5001")))
