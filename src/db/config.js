const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

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

console.log(
  'db config === DATABASE_URL is',
  process.env.DATABASE_URL ? 'set' : 'NOT SET'
);

module.exports = { db };
