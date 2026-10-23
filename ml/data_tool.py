"""Консольное приложение для изменения набора данных data/tickets.csv.

Примеры:
  python ml/data_tool.py stats
  python ml/data_tool.py list -n 5
  python ml/data_tool.py add --text "laptop screen is broken need replacement" --category Hardware --push
  python ml/data_tool.py delete --id 15
  python ml/data_tool.py noise --frac 0.5          # испортить метки (проверка quality gate)
  python ml/data_tool.py validate                  # проверка перед обучением (в Jenkins)

Ключ --push после изменения делает git commit + git push файла набора,
что запускает переобучение модели в Jenkins.
"""
import argparse
import subprocess
import sys

from common import LABEL, ROOT, TEXT, TRAIN_CSV, load_csv

MIN_ROWS, MIN_PER_CLASS = 100, 10


def save(df, message, push):
    df.to_csv(TRAIN_CSV, index=False)
    print(f"Сохранено: {TRAIN_CSV.relative_to(ROOT)} ({len(df)} записей)")
    if push:
        path = str(TRAIN_CSV.relative_to(ROOT))
        for cmd in (["git", "add", path], ["git", "commit", "-m", f"data: {message}"], ["git", "push"]):
            print("$", " ".join(cmd))
            subprocess.run(cmd, cwd=ROOT, check=True)


def cmd_stats(df, a):
    print(f"Записей: {len(df)}, категорий: {df[LABEL].nunique()}")
    print(df[LABEL].value_counts().to_string())


def cmd_list(df, a):
    for _, r in df.tail(a.n).iterrows():
        print(f"#{r['id']:<6} {r[LABEL]:<22} {r[TEXT][:70]}")


def cmd_add(df, a):
    if a.category not in set(df[LABEL]):
        sys.exit(f"Неизвестная категория. Допустимые: {sorted(set(df[LABEL]))}")
    new_id = int(df["id"].max()) + 1
    df.loc[len(df)] = {"id": new_id, TEXT: a.text.strip().lower(), LABEL: a.category}
    print(f"Добавлена запись #{new_id}")
    save(df, f"add #{new_id} ({a.category})", a.push)


def cmd_delete(df, a):
    if a.id not in set(df["id"]):
        sys.exit(f"Записи #{a.id} нет")
    save(df[df["id"] != a.id], f"delete #{a.id}", a.push)


def cmd_noise(df, a):
    idx = df.sample(frac=a.frac, random_state=1).index
    df.loc[idx, LABEL] = df.loc[idx, LABEL].sample(frac=1, random_state=2).values
    print(f"Перемешаны метки у {len(idx)} записей")
    save(df, f"noise {a.frac}", a.push)


def cmd_validate(df, a):
    errors = []
    if list(df.columns) != ["id", TEXT, LABEL]:
        errors.append(f"неверные колонки: {list(df.columns)}")
    if len(df) < MIN_ROWS:
        errors.append(f"мало записей: {len(df)} < {MIN_ROWS}")
    if (df[TEXT].str.strip() == "").any() or (df[LABEL].str.strip() == "").any():
        errors.append("есть пустые значения")
    if df["id"].duplicated().any():
        errors.append("повторяющиеся id")
    small = df[LABEL].value_counts()
    small = small[small < MIN_PER_CLASS]
    if len(small):
        errors.append(f"мало примеров в категориях: {small.to_dict()}")
    if errors:
        sys.exit("Набор данных не прошёл проверку:\n - " + "\n - ".join(errors))
    print(f"Набор данных корректен: {len(df)} записей, {df[LABEL].nunique()} категорий")


def main():
    ap = argparse.ArgumentParser(description="Изменение набора данных IT-заявок")
    push = argparse.ArgumentParser(add_help=False)
    push.add_argument("--push", action="store_true", help="git commit + push после изменения")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("stats", help="статистика по категориям")
    p = sub.add_parser("list", help="последние записи"); p.add_argument("-n", type=int, default=10)
    p = sub.add_parser("add", help="добавить запись", parents=[push])
    p.add_argument("--text", required=True); p.add_argument("--category", required=True)
    p = sub.add_parser("delete", help="удалить запись", parents=[push]); p.add_argument("--id", type=int, required=True)
    p = sub.add_parser("noise", help="перемешать часть меток", parents=[push]); p.add_argument("--frac", type=float, default=0.3)
    sub.add_parser("validate", help="проверить набор перед обучением")
    a = ap.parse_args()
    globals()[f"cmd_{a.cmd}"](load_csv(TRAIN_CSV), a)


if __name__ == "__main__":
    main()
