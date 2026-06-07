const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

db.on('error', err => {
  console.error('Unexpected DB pool error:', err);
});

module.exports = { db };
