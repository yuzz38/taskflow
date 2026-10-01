const { Pool } = require('pg');

// Каждый микросервис подключается ТОЛЬКО к своей базе данных (DB_NAME).
// Логин/пароль приходят из Kubernetes Secret (postgres-secret).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DB_NAME,
});

// Создаём таблицы. Если БД ещё не поднялась — ждём и пробуем снова.
async function init(schemaSql, retries = 30) {
  for (let i = 1; ; i++) {
    try {
      await pool.query(schemaSql);
      console.log('DB ready');
      return;
    } catch (e) {
      if (i >= retries) throw e;
      console.log(`DB not ready (${e.message}), retry ${i}/${retries}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

module.exports = { pool, init };
