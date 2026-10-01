// users-service — микросервис пользователей.
// Владеет только своими данными (база users_db), наружу отдаёт REST API /api/users.
const express = require('express');
const os = require('os');
const { pool, init } = require('./db');

const SERVICE = 'users-service';
const PORT = process.env.PORT || 3000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);`;

const app = express();
app.use(express.json());

// В каждом ответе пишем имя пода — видно, какая реплика обработала запрос
app.use((req, res, next) => { res.set('X-Pod', os.hostname()); next(); });

// Health-check: используется Kubernetes (liveness/readiness) и фронтендом
const health = (req, res) => res.json({ status: 'ok', service: SERVICE, pod: os.hostname() });
app.get('/health', health);
app.get('/api/users/health', health);

// Обёртка: ошибки async-обработчиков попадают в общий обработчик ошибок
const wrap = fn => (req, res, next) => fn(req, res).catch(next);
const router = express.Router();

// CREATE
router.post('/', wrap(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const { rows } = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *', [name, email]);
  res.status(201).json(rows[0]);
}));

// READ ALL
router.get('/', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY id');
  res.json(rows);
}));

// READ ONE (этим маршрутом пользуется tasks-service для проверки исполнителя)
router.get('/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// UPDATE
router.put('/:id', wrap(async (req, res) => {
  const { name, email } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3 RETURNING *',
    [name ?? null, email ?? null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// DELETE
router.delete('/:id', wrap(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
}));

app.use('/api/users', router);

// Общий обработчик ошибок
app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'email already exists' });
  if (err.code === '22P02') return res.status(400).json({ error: 'invalid id' });
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

// Сначала готовим БД, потом начинаем принимать запросы
init(SCHEMA)
  .then(() => {
    const server = app.listen(PORT, () => console.log(`${SERVICE} on port ${PORT}, pod ${os.hostname()}`));
    // Корректное завершение, когда Kubernetes останавливает под
    process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));
  })
  .catch(e => { console.error('DB init failed', e); process.exit(1); });
