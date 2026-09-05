const express = require('express');
const db = require('../db');

const router = express.Router();

// CREATE
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(409).json({ error: 'category already exists' });
  }
});

// READ ALL
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY id').all());
});

// READ ONE
router.get('/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'not found' });
  res.json(cat);
});

// UPDATE
router.put('/:id', (req, res) => {
  const { name } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE categories SET name = COALESCE(?, name) WHERE id = ?').run(name, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// DELETE
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});

module.exports = router;
