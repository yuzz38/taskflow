# TaskFlow — микросервисы в Kubernetes (лабораторная работа №3)

## Архитектура

```
Браузер → localhost:30080 (Service NodePort)
            └→ frontend (nginx, 2 реплики) ─┬→ /api/users      → users-service      (3 реплики) → users_db
                                            ├→ /api/categories → categories-service (3 реплики) → categories_db
                                            └→ /api/tasks,     → tasks-service      (3 реплики) → tasks_db
                                               /api/comments          │  HTTP-запросы к users-service
                                                                      └→ и categories-service
                                            PostgreSQL (1 реплика + PersistentVolume)
```

Принципы микросервисной архитектуры:
- каждый сервис отвечает за одну бизнес-область и разворачивается независимо (свой образ, свой Deployment);
- у каждого сервиса своя база данных, чужие таблицы напрямую не читаются;
- сервисы общаются только по HTTP API через DNS-имена Kubernetes Service;
- отказ одного сервиса не роняет остальные (tasks-service отдаёт задачи даже без имён исполнителей);
- сервисы stateless — поэтому их можно масштабировать репликами.

## Запуск

```powershell
.\build.ps1                 # собрать образы
kubectl apply -f k8s/       # развернуть всё в кластер
kubectl get pods -w         # дождаться, пока все поды будут Running и READY 1/1
```

Приложение: http://localhost:30080

## Удаление

```powershell
kubectl delete -f k8s/
```
