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

## CI/CD

Сборка настроена в Jenkins через `Jenkinsfile` в корне репозитория (без Docker — деплой
выполняется менеджером процессов **pm2**, который ставится локально через `npx`,
глобальная установка на агенте Jenkins не требуется).
См. отчёт `docs/report.docx` за подробностями конфигурации Jenkins и веб-хука GitHub.

## Ветки репозитория

- `main` — стабильная версия, из неё разворачивается CD
- `dev` — интеграционная ветка, сюда мёржатся фичи после ревью
- `feature/*` — ветки разработки отдельных функций/исправлений (например, `feature/task-comments`)
