const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { db } = require('../db/config');

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'chiateam-bot-storage-')
);
process.env.BOT_STATE_FILE = path.join(temporaryDirectory, 'storage.json');
delete process.env.DATABASE_URL;

const {
  createDefaultBotStorage,
  readBotStorage,
  writeBotStorage,
} = require('./bot-storage-service');

test.after(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('bot storage keeps the venue in defaults and the JSON mirror', async () => {
  assert.equal(createDefaultBotStorage().san, null);

  const saved = await writeBotStorage({ san: 'Sân số 8' });
  const loaded = await readBotStorage();

  assert.equal(saved.san, 'Sân số 8');
  assert.equal(loaded.san, 'Sân số 8');
});

test('database storage writes the venue text column', async t => {
  const originalQuery = db.query;
  const queries = [];
  process.env.DATABASE_URL = 'postgres://storage-test';
  db.query = async (statement, values = []) => {
    const sql = String(statement);
    queries.push({ sql, values });

    if (sql.includes('INSERT INTO storage')) {
      return { rows: [{ san: values[8] }] };
    }

    return { rows: [] };
  };
  t.after(() => {
    db.query = originalQuery;
    delete process.env.DATABASE_URL;
  });

  await writeBotStorage({ san: 'Sân số 9' });

  const insert = queries.find(({ sql }) => sql.includes('INSERT INTO storage'));
  assert.ok(insert);
  assert.match(insert.sql, /manifest,\s+san,\s+tiensan/);
  assert.equal(insert.values[8], 'Sân số 9');
});
