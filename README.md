# TaskFlow

Трёхзвенное CRUD-приложение для лабораторной работы по CI/CD.

**Архитектура:**
- Клиент — статический HTML/CSS/JS (`/frontend`)
- Сервер — Node.js + Express (`/backend`), REST API
- База данных — SQLite (файл `backend/taskflow.db`, создаётся автоматически)

**Сущности и CRUD (21 операция):**
- Users: create, read all, read one, update, delete
- Categories: create, read all, read one, update, delete
- Tasks: create, read all (+ фильтры по category/user/status), read one, update, delete, complete
- Comments: create (nested), read (nested), delete

## Запуск локально

```bash
cd backend
npm install
npm start          # http://localhost:3000
```

## Тесты

```bash
cd backend
npm test
```

## Запуск в Docker (лабораторная работа №2)

```bash
docker compose up -d --build
# Приложение:  http://localhost:8000
# Health API:  http://localhost:8000/api/health
```

Архитектура развёртывания:

```
Браузер → nginx (порт 8000) ─┬→ / ....... статика фронтенда
                             └→ /api/ ... proxy_pass → backend:3000 (контейнер Node.js)
                                                          └→ SQLite в volume taskflow-db
```

Полезные команды:

```bash
docker compose ps            # статус контейнеров
docker compose logs -f       # логи
docker compose down          # остановить и удалить контейнеры
```

## CI/CD

Сборка настроена в Jenkins через `Jenkinsfile` в корне репозитория:
Checkout → Install → Test → Build Docker image → Deploy (`docker compose up -d`) → Smoke test.
Этапы Deploy и Smoke test выполняются только для ветки `main`.
См. отчёт `docs/report.docx` за подробностями конфигурации Jenkins и веб-хука GitHub.

## Ветки репозитория

- `main` — стабильная версия, из неё разворачивается CD
- `dev` — интеграционная ветка, сюда мёржатся фичи после ревью
- `feature/*` — ветки разработки отдельных функций/исправлений (например, `feature/task-comments`)
