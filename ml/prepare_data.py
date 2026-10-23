import argparse
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from common import DATA_DIR, LABEL, TEST_CSV, TEXT, TRAIN_CSV

KAGGLE_ID = "adisongoh/it-service-ticket-classification-dataset"
FILE_NAME = "all_tickets_processed_improved_v3.csv"


def find_source(src):
    if src:
        return Path(src)
    local = DATA_DIR / "raw" / FILE_NAME
    if local.exists():
        return local
    import kagglehub
    path = Path(kagglehub.dataset_download(KAGGLE_ID))
    return path / FILE_NAME


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="путь к CSV с Kaggle")
    ap.add_argument("--size", type=int, default=7500, help="сколько записей взять из набора")
    ap.add_argument("--test", type=float, default=0.2, help="доля тестовой выборки")
    args = ap.parse_args()

    src = find_source(args.src)
    print(f"Источник: {src}")
    df = pd.read_csv(src).rename(columns={"Document": TEXT, "Topic_group": LABEL})[[TEXT, LABEL]]
    print(f"Исходный набор: {len(df)} записей, {df[LABEL].nunique()} категорий")

    # очистка: пустые, дубликаты, слишком короткие тексты
    df[TEXT] = df[TEXT].astype(str).str.strip()
    df = df[df[TEXT].str.split().str.len() >= 3].drop_duplicates(TEXT)
    print(f"После очистки: {len(df)}")

    # уменьшаем набор (со стратификацией), чтобы сеть обучалась за минуты на ноутбуке
    if args.size < len(df):
        df, _ = train_test_split(df, train_size=args.size, stratify=df[LABEL], random_state=42)

    train, test = train_test_split(df, test_size=args.test, stratify=df[LABEL], random_state=42)
    DATA_DIR.mkdir(exist_ok=True)
    for part, path in ((train, TRAIN_CSV), (test, TEST_CSV)):
        part = part.reset_index(drop=True)
        part.insert(0, "id", range(1, len(part) + 1))
        part.to_csv(path, index=False)
        print(f"{path.relative_to(DATA_DIR.parent)}: {len(part)} записей")
    print("\nРаспределение категорий (обучающий набор):")
    print(train[LABEL].value_counts().to_string())


if __name__ == "__main__":
    main()
