const path = require('path');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();

dotenv.config();

const DATABASE_NAME = process.env.DATABASE_NAME || 'default';

const dbPath = path.join(__dirname, `${DATABASE_NAME}.db`);
const schemaPath = path.join(__dirname, '../script/tables.sql');

const db = new sqlite3.Database(dbPath);

module.exports = {
  dbPath,
  schemaPath,
  db,
};
