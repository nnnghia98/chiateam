const path = require('path');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();

dotenv.config();

const DATABASE_NAME = `${process.env.DATABASE_NAME || 'default'}.db`;
const DB_DIR = process.env.DB_DIR || path.dirname(__filename);
const SCHEMA_PATH = '../script/tables.sql';

const dbPath = path.join(DB_DIR, DATABASE_NAME);

const db = new sqlite3.Database(dbPath);

module.exports = {
  dbPath,
  SCHEMA_PATH,
  db,
};
