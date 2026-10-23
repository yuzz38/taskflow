"""Обучение нейронной сети с записью в MLflow и выбором лучшей модели.

Модель — многослойный перцептрон (MLPClassifier) на TF-IDF признаках текста
заявки. Перебираются все комбинации гиперпараметров из ml/params.json,
каждая комбинация — вложенный run MLflow с гиперпараметрами и метриками.
Лучшая модель (max val_f1_macro) регистрируется в Model Registry
с алиасом candidate; решение о выпуске принимает evaluate.py.
"""
import itertools
import json
import os
import time

from mlflow.tracking import MlflowClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline

from common import (LABEL, MODEL_NAME, PARAMS_JSON, TEST_CSV, TEXT, TRAIN_CSV,
                    file_md5, load_csv, save_report, setup_mlflow)

BUILD = os.getenv("BUILD_NUMBER", "local")


def param_grid(grid):
    keys = list(grid)
    for values in itertools.product(*(grid[k] for k in keys)):
        yield dict(zip(keys, values))


def build_model(p, fixed):
    return Pipeline([
        ("tfidf", TfidfVectorizer(max_features=p["max_features"],
                                  ngram_range=(1, fixed["ngram_max"]), sublinear_tf=True)),
        ("mlp", MLPClassifier(hidden_layer_sizes=tuple(p["hidden_layer_sizes"]),
                              alpha=p["alpha"],
                              learning_rate_init=fixed["learning_rate_init"],
                              batch_size=fixed["batch_size"],
                              max_iter=fixed["max_iter"],
                              early_stopping=True, n_iter_no_change=3,
                              random_state=42)),
    ])


def scores(model, X, y):
    pred = model.predict(X)
    return f1_score(y, pred, average="macro"), accuracy_score(y, pred)


def main():
    mlflow = setup_mlflow()
    cfg = json.loads(PARAMS_JSON.read_text(encoding="utf-8"))
    fixed = cfg["fixed"]

    df = load_csv(TRAIN_CSV)
    test = load_csv(TEST_CSV)
    X_tr, X_val, y_tr, y_val = train_test_split(
        df[TEXT], df[LABEL], test_size=fixed["val_size"], stratify=df[LABEL], random_state=42)
    print(f"Набор: {len(df)} записей (train {len(X_tr)}, val {len(X_val)}), тест {len(test)}")

    best = None
    with mlflow.start_run(run_name=f"build-{BUILD}") as parent:
        mlflow.log_params({f"fixed_{k}": v for k, v in fixed.items()})
        mlflow.log_params({"data_rows": len(df), "data_md5": file_md5(TRAIN_CSV), "build": BUILD})

        for i, p in enumerate(param_grid(cfg["grid"]), 1):
            with mlflow.start_run(run_name=f"trial-{i}", nested=True):
                mlflow.log_params(p)                      # фиксация гиперпараметров
                t0 = time.time()
                model = build_model(p, fixed).fit(X_tr, y_tr)
                f1, acc = scores(model, X_val, y_val)
                mlp = model.named_steps["mlp"]
                mlflow.log_metrics({"val_f1_macro": f1, "val_accuracy": acc,
                                    "train_time_sec": time.time() - t0, "epochs": mlp.n_iter_})
                for step, loss in enumerate(mlp.loss_curve_):
                    mlflow.log_metric("loss", loss, step=step)
                print(f"[{i}] {p} -> val_f1_macro={f1:.4f} val_accuracy={acc:.4f}")
                if best is None or f1 > best["f1"]:
                    best = {"f1": f1, "acc": acc, "params": p, "model": model}

        # лучшая модель: метрики на эталонном тесте, сохранение и регистрация
        test_f1, test_acc = scores(best["model"], test[TEXT], test[LABEL])
        mlflow.log_params({f"best_{k}": v for k, v in best["params"].items()})
        mlflow.log_metrics({"best_val_f1_macro": best["f1"], "test_f1_macro": test_f1,
                            "test_accuracy": test_acc})
        mlflow.sklearn.log_model(best["model"], "model", registered_model_name=MODEL_NAME,
                                 input_example=["printer in room 204 does not print"])

    client = MlflowClient()
    version = client.search_model_versions(f"run_id='{parent.info.run_id}'")[0].version
    for k, v in {"build": BUILD, "data_md5": file_md5(TRAIN_CSV),
                 "test_f1_macro": f"{test_f1:.4f}", **{k: str(v) for k, v in best["params"].items()}}.items():
        client.set_model_version_tag(MODEL_NAME, version, k, v)
    client.set_registered_model_alias(MODEL_NAME, "candidate", version)

    report = {"version": version, "run_id": parent.info.run_id, "params": best["params"],
              "val_f1_macro": best["f1"], "test_f1_macro": test_f1, "test_accuracy": test_acc}
    save_report("candidate.json", report)
    print(f"\nЛучшие гиперпараметры: {best['params']}")
    print(f"Модель {MODEL_NAME} v{version}: val_f1_macro={best['f1']:.4f}, "
          f"test_f1_macro={test_f1:.4f}, test_accuracy={test_acc:.4f} -> алиас candidate")


if __name__ == "__main__":
    main()
