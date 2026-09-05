const express = require('express');
const db = require('../db');

const router = express.Router();

// DELETE comment by id (create/read реализованы во вложенных роутах tasks.js)
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});

module.exports = router;
