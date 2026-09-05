const express = require('express');
const db = require('../db');

const router = express.Router();

// CREATE
router.post('/', (req, res) => {
  const { title, description, user_id, category_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const info = db.prepare(
    'INSERT INTO tasks (title, description, user_id, category_id) VALUES (?, ?, ?, ?)'
  ).run(title, description || null, user_id || null, category_id || null);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

// READ ALL (+ фильтры по category / user / status)
router.get('/', (req, res) => {
  const { category, user, status, search } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category_id = ?'; params.push(category); }
  if (user) { sql += ' AND user_id = ?'; params.push(user); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY id';
  res.json(db.prepare(sql).all(...params));
});

// READ ONE
router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

// UPDATE
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { title, description, status, user_id, category_id } = req.body;
  db.prepare(`UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      user_id = COALESCE(?, user_id),
      category_id = COALESCE(?, category_id)
    WHERE id = ?`)
    .run(title, description, status, user_id, category_id, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// PATCH — отметить как выполненную
router.patch('/:id/complete', (req, res) => {
  const info = db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// DELETE
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});

// --- Комментарии к задаче (вложенный ресурс) ---

// CREATE comment
router.post('/:id/comments', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'task not found' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const info = db.prepare('INSERT INTO comments (task_id, text) VALUES (?, ?)').run(req.params.id, text);
  res.status(201).json(db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid));
});

// READ comments for task
router.get('/:id/comments', (req, res) => {
  res.json(db.prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY id').all(req.params.id));
});

module.exports = router;
