const express = require('express');
const cors = require('cors');
const path = require('path');

const usersRouter = require('./routes/users');
const categoriesRouter = require('./routes/categories');
const tasksRouter = require('./routes/tasks');
const commentsRouter = require('./routes/comments');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'taskflow-backend' }));

app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/comments', commentsRouter);

// Отдаём статику фронтенда (клиентский уровень 3-звенной архитектуры)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`TaskFlow backend listening on port ${PORT}`));
}

module.exports = app;
