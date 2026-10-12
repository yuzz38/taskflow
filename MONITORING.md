# Лабораторная работа №4 — мониторинг кластера Kubernetes

```
            ┌────────────── namespace monitoring ──────────────┐
Браузер ──► │ Grafana :30030 ──► Prometheus :30090              │
            │                     │ опрашивает (scrape):        │
            │                     ├─► prometheus (сам себя)     │
            │                     ├─► node-exporter :9100       │  метрики узла
            │                     ├─► cadvisor :8080            │  метрики контейнеров
            │                     └─► kubelet /metrics/cadvisor │  метрики контейнеров с метками pod/namespace/container
            └───────────────────────────────────────────────────┘
```

## Запуск

```powershell
kubectl apply -f monitoring/
kubectl get pods -n monitoring -w
```

- Prometheus: http://localhost:30090 (Status → Targets)
- Grafana: http://localhost:30030 (admin / admin), дашборд в папке TaskFlow
- cAdvisor: http://localhost:30088

## Стресс-тесты

```powershell
kubectl apply -f stress-test/memory-stress.yaml   # память → OOMKilled
kubectl apply -f stress-test/cpu-stress.yaml      # CPU → троттлинг
kubectl delete -f stress-test/                    # убрать
```

## Удаление мониторинга

```powershell
kubectl delete -f monitoring/
```
