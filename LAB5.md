# Лабораторная работа №5 — основы MLOps (Continuous Training)

Система TaskFlow из ЛР3 запускается **без Kubernetes** — через Docker Compose.
Добавлены: сервер MLflow, микросервис `ml-service` (классификация заявок)
и конвейер непрерывного обучения в Jenkins.

```
GitHub (код + data/tickets.csv) ──pollSCM──► Jenkins (Jenkinsfile)
                                              │ validate → train → quality gate → deploy
                                              ▼
                                         MLflow :5000  ◄── ml-service ◄── frontend :8081
                                    (runs, params, models,     (модель champion)
                                     Model Registry)
```

| Файл | Назначение |
|---|---|
| `ml/prepare_data.py` | загрузка набора с Kaggle, очистка, разбиение на `data/tickets.csv` и `data/tickets_test.csv` |
| `ml/params.json` | сетка гиперпараметров |
| `ml/train.py` | обучение MLP, запись в MLflow, выбор лучшей модели, регистрация (алиас `candidate`) |
| `ml/evaluate.py` | quality gate: если новая модель хуже — `ModelQualityError`; иначе алиас `champion` |
| `ml/data_tool.py` | консольное приложение для изменения набора данных |
| `ml/reload.py` | команда ml-service перечитать модель |
| `Jenkinsfile` | декларативный конвейер + триггер `pollSCM` |
| `docker-compose.yml` | вся система + сервер MLflow |

**Модель** — собственная нейросеть: многослойный перцептрон (`MLPClassifier`) на TF-IDF признаках.
**Набор данных** — [IT Service Ticket Classification Dataset](https://www.kaggle.com/datasets/adisongoh/it-service-ticket-classification-dataset)
(Kaggle, 47 837 IT-заявок, 8 категорий: Hardware, HR Support, Access, Miscellaneous, Storage,
Purchase, Internal Project, Administrative rights).

## Порядок запуска (Windows, PowerShell)

Нужны: Docker Desktop, Python **3.11 или 3.12** (mlflow 2.17 не ставится на 3.13), Git, Jenkins.

```powershell
# 1. Система + MLflow
docker compose up -d --build
#    приложение http://localhost:8081, MLflow http://localhost:5000

# 2. Окружение для ML
python -m venv venv-ml
.\venv-ml\Scripts\activate
pip install -r ml/requirements.txt

# 3. Набор данных: скачать архив с Kaggle (кнопка Download), распаковать
#    all_tickets_processed_improved_v3.csv в data/raw/  (или скрипт сам скачает через kagglehub)
python ml/prepare_data.py
git add data/tickets.csv data/tickets_test.csv; git commit -m "dataset"; git push

# 4. Первое обучение вручную (по желанию — можно сразу через Jenkins)
python ml/train.py
python ml/evaluate.py
python ml/reload.py
```

## Jenkins

1. New Item → `taskflow-ml` → **Pipeline**.
2. Pipeline → Definition: *Pipeline script from SCM* → Git → URL репозитория, ветка `*/main`, Script Path `Jenkinsfile`.
3. Нажать **Build Now** один раз — после этого Jenkins зарегистрирует триггер `pollSCM` (виден в Configure → Build Triggers).
4. Python должен быть доступен Jenkins (`python` в PATH для службы Jenkins).

Порты: Jenkins обычно на 8080, поэтому приложение вынесено на **8081**.

## Демонстрация триггера и quality gate

```powershell
# изменение набора → коммит → через ≤2 минуты Jenkins сам запускает обучение
python ml/data_tool.py add --text "laptop screen broken need replacement" --category Hardware --push

# испортить метки → новая модель хуже → этап Quality gate падает с ModelQualityError
python ml/data_tool.py noise --frac 0.5 --push
# откатить порчу
git revert --no-edit HEAD; git push
```

Другие команды: `python ml/data_tool.py stats | list -n 5 | delete --id 15 | validate`.
