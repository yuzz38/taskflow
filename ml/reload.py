"""Команда ml-service перечитать модель с алиасом champion (этап Deploy model)."""
import json
import os
import urllib.request

url = os.getenv("ML_SERVICE_URL", "http://localhost:8081") + "/api/ml/reload"
with urllib.request.urlopen(urllib.request.Request(url, method="POST"), timeout=120) as r:
    print(json.dumps(json.load(r), ensure_ascii=False, indent=2))
