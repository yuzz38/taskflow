"""Общие настройки ML-части TaskFlow (лабораторная работа №5, MLOps)."""
import hashlib
import json
import os
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
TRAIN_CSV = DATA_DIR / "tickets.csv"        # обучающий набор (его меняет data_tool.py)
TEST_CSV = DATA_DIR / "tickets_test.csv"    # эталонная тестовая выборка (не меняется)
PARAMS_JSON = Path(__file__).resolve().parent / "params.json"
REPORTS_DIR = ROOT / "reports"

TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
EXPERIMENT = "ticket-classification"
MODEL_NAME = "ticket-classifier"

TEXT, LABEL = "text", "category"


def setup_mlflow():
    import mlflow
    mlflow.set_tracking_uri(TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT)
    return mlflow


def load_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype={TEXT: str, LABEL: str}, keep_default_na=False)


def file_md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def save_report(name: str, data: dict):
    REPORTS_DIR.mkdir(exist_ok=True)
    (REPORTS_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
