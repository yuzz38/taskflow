// tasks-service — микросервис задач и комментариев (база tasks_db).
// О пользователях и категориях он НЕ хранит данных: при необходимости
// обращается к users-service и categories-service по HTTP.
const express = require('express');
const os = require('os');
const { pool, init } = require('./db');

const SERVICE = 'tasks-service';
const PORT = process.env.PORT || 3000;
const USERS_URL = process.env.USERS_URL || 'http://users-service:3000';
const CATEGORIES_URL = process.env.CATEGORIES_URL || 'http://categories-service:3000';

// user_id и category_id — просто числа, внешних ключей нет:
// таблицы пользователей и категорий живут в других сервисах и других БД.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  user_id INTEGER,
  category_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);`;

// ---------- Взаимодействие с другими микросервисами ----------

// Проверить, что сущность существует в другом сервисе (например, пользователь)
async function existsIn(baseUrl, path, id) {
  if (id === null || id === undefined || id === '') return true;
  let r;
  try {
    r = await fetch(`${baseUrl}${path}/${id}`, { signal: AbortSignal.timeout(3000) });
  } catch {
    throw Object.assign(new Error(`${baseUrl} unavailable`), { status: 503 });
  }
  if (r.status === 404 || r.status === 400) return false;
  if (!r.ok) throw Object.assign(new Error(`${baseUrl} error ${r.status}`), { status: 503 });
  return true;
}

// Получить справочник id → name. Если сервис недоступен — вернуть null,
// чтобы список задач всё равно отобразился (сервисы не роняют друг друга).
async function fetchNames(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return null;
    const list = await r.json();
    return new Map(list.map(x => [x.id, x.name]));
  } catch {
    return null;
  }
}

async function validateRefs(user_id, category_id) {
  if (!(await existsIn(USERS_URL, '/api/users', user_id))) return 'user not found';
  if (!(await existsIn(CATEGORIES_URL, '/api/categories', category_id))) return 'category not found';
  return null;
}

// ---------- HTTP API ----------

const app = express();
app.use(express.json());
app.use((req, res, next) => { res.set('X-Pod', os.hostname()); next(); });

const health = (req, res) => res.json({ status: 'ok', service: SERVICE, pod: os.hostname() });
app.get('/health', health);
app.get('/api/tasks/health', health);

const wrap = fn => (req, res, next) => fn(req, res).catch(next);
const tasks = express.Router();

// CREATE
tasks.post('/', wrap(async (req, res) => {
  const { title, description, user_id, category_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const refError = await validateRefs(user_id, category_id);
  if (refError) return res.status(400).json({ error: refError });
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, description, user_id, category_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, description || null, user_id || null, category_id || null]);
  res.status(201).json(rows[0]);
}));

// READ ALL (+ фильтры) — дополняем задачи именами исполнителя и категории
tasks.get('/', wrap(async (req, res) => {
  const { category, user, status, search } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (category) { params.push(category); sql += ` AND category_id = $${params.length}`; }
  if (user) { params.push(user); sql += ` AND user_id = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND title ILIKE $${params.length}`; }
  sql += ' ORDER BY id';
  const { rows } = await pool.query(sql, params);

  const [users, categories] = await Promise.all([
    fetchNames(`${USERS_URL}/api/users`),
    fetchNames(`${CATEGORIES_URL}/api/categories`),
  ]);
  res.json(rows.map(t => ({
    ...t,
    user_name: users ? users.get(t.user_id) ?? null : null,
    category_name: categories ? categories.get(t.category_id) ?? null : null,
  })));
}));

// READ ONE
tasks.get('/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// UPDATE
tasks.put('/:id', wrap(async (req, res) => {
  const { title, description, status, user_id, category_id } = req.body;
  const refError = await validateRefs(user_id, category_id);
  if (refError) return res.status(400).json({ error: refError });
  const { rows } = await pool.query(`UPDATE tasks SET
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      status = COALESCE($3, status),
      user_id = COALESCE($4, user_id),
      category_id = COALESCE($5, category_id)
    WHERE id = $6 RETURNING *`,
    [title ?? null, description ?? null, status ?? null, user_id ?? null, category_id ?? null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// PATCH — отметить как выполненную
tasks.patch('/:id/complete', wrap(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE tasks SET status = 'done' WHERE id = $1 RETURNING *", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// DELETE
tasks.delete('/:id', wrap(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
}));

// CREATE comment
tasks.post('/:id/comments', wrap(async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const task = await pool.query('SELECT id FROM tasks WHERE id = $1', [req.params.id]);
  if (!task.rows[0]) return res.status(404).json({ error: 'task not found' });
  const { rows } = await pool.query(
    'INSERT INTO comments (task_id, text) VALUES ($1, $2) RETURNING *', [req.params.id, text]);
  res.status(201).json(rows[0]);
}));

// READ comments for task
tasks.get('/:id/comments', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM comments WHERE task_id = $1 ORDER BY id', [req.params.id]);
  res.json(rows);
}));

// DELETE comment
const comments = express.Router();
comments.delete('/:id', wrap(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
}));

app.use('/api/tasks', tasks);
app.use('/api/comments', comments);

app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '22P02') return res.status(400).json({ error: 'invalid id' });
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

init(SCHEMA)
  .then(() => {
    const server = app.listen(PORT, () => console.log(`${SERVICE} on port ${PORT}, pod ${os.hostname()}`));
    process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));
  })
  .catch(e => { console.error('DB init failed', e); process.exit(1); });
