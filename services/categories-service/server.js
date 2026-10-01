// categories-service — микросервис категорий.
// Владеет только своими данными (база categories_db), наружу отдаёт REST API /api/categories.
const express = require('express');
const os = require('os');
const { pool, init } = require('./db');

const SERVICE = 'categories-service';
const PORT = process.env.PORT || 3000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);`;

const app = express();
app.use(express.json());

// В каждом ответе пишем имя пода — видно, какая реплика обработала запрос
app.use((req, res, next) => { res.set('X-Pod', os.hostname()); next(); });

// Health-check: используется Kubernetes (liveness/readiness) и фронтендом
const health = (req, res) => res.json({ status: 'ok', service: SERVICE, pod: os.hostname() });
app.get('/health', health);
app.get('/api/categories/health', health);

// Обёртка: ошибки async-обработчиков попадают в общий обработчик ошибок
const wrap = fn => (req, res, next) => fn(req, res).catch(next);
const router = express.Router();

// CREATE
router.post('/', wrap(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
  res.status(201).json(rows[0]);
}));

// READ ALL
router.get('/', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY id');
  res.json(rows);
}));

// READ ONE (используется tasks-service для проверки категории)
router.get('/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// UPDATE
router.put('/:id', wrap(async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query(
    'UPDATE categories SET name = COALESCE($1, name) WHERE id = $2 RETURNING *',
    [name ?? null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// DELETE
router.delete('/:id', wrap(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
}));

app.use('/api/categories', router);

// Общий обработчик ошибок
app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'category already exists' });
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
