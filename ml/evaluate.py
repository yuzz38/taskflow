"""Проверка качества (quality gate).

Новая модель (алиас candidate) сравнивается с текущей рабочей (алиас champion)
на одной и той же эталонной тестовой выборке. Если новая модель хуже —
выбрасывается исключение ModelQualityError, скрипт завершается с ошибкой
и этап конвейера Jenkins падает. Иначе новая модель становится champion.
"""
import os

from mlflow.exceptions import MlflowException
from mlflow.tracking import MlflowClient
from sklearn.metrics import f1_score

from common import LABEL, MODEL_NAME, TEST_CSV, TEXT, load_csv, save_report, setup_mlflow

MIN_DELTA = float(os.getenv("MIN_DELTA", "0.005"))  # допустимое отклонение f1


class ModelQualityError(Exception):
    """Новая модель работает хуже предыдущей."""


def get_version(client, alias):
    try:
        return client.get_model_version_by_alias(MODEL_NAME, alias)
    except MlflowException:
        return None


def test_f1(mlflow, version, test):
    model = mlflow.sklearn.load_model(f"models:/{MODEL_NAME}/{version}")
    return f1_score(test[LABEL], model.predict(test[TEXT]), average="macro")


def main():
    mlflow = setup_mlflow()
    client = MlflowClient()
    test = load_csv(TEST_CSV)

    cand = get_version(client, "candidate")
    if cand is None:
        raise SystemExit("Нет модели с алиасом candidate — сначала запустите train.py")
    champ = get_version(client, "champion")

    new_f1 = test_f1(mlflow, cand.version, test)
    old_f1 = test_f1(mlflow, champ.version, test) if champ else None
    passed = old_f1 is None or new_f1 >= old_f1 - MIN_DELTA

    print(f"Новая модель v{cand.version}: test_f1_macro = {new_f1:.4f}")
    if champ:
        print(f"Текущая модель v{champ.version}: test_f1_macro = {old_f1:.4f} (min_delta {MIN_DELTA})")
    else:
        print("Рабочей модели ещё нет — сравнивать не с чем")

    client.set_model_version_tag(MODEL_NAME, cand.version, "quality_gate", "passed" if passed else "failed")
    save_report("quality_gate.json", {"candidate": cand.version, "candidate_f1": new_f1,
                                      "champion": champ.version if champ else None,
                                      "champion_f1": old_f1, "min_delta": MIN_DELTA, "passed": passed})
    if not passed:
        raise ModelQualityError(f"Новая модель v{cand.version} хуже текущей v{champ.version}: "
                                f"f1_macro {new_f1:.4f} < {old_f1:.4f}")

    client.set_registered_model_alias(MODEL_NAME, "champion", cand.version)
    print(f"Проверка пройдена: v{cand.version} -> алиас champion")


if __name__ == "__main__":
    main()
