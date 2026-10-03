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
  resetBotStorage,
} = require('./bot-storage-service');

test.after(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('bot storage requires DATABASE_URL for read, write, and reset', async t => {
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(' '));
  t.after(() => {
    console.error = originalError;
  });
  for (const value of [undefined, '   ']) {
    if (value === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = value;
    for (const operation of [
      readBotStorage,
      () => writeBotStorage({ san: 'Sân số 8' }),
      resetBotStorage,
    ]) {
      await assert.rejects(
        operation,
        error => error.code === 'DATABASE_NOT_CONFIGURED'
      );
    }
  }
  delete process.env.DATABASE_URL;
  assert.equal(logs.length, 6);
  assert.ok(logs.every(message => message.includes('DATABASE_URL')));
  assert.equal(fs.existsSync(process.env.BOT_STATE_FILE), false);
});

test('database storage never reads, writes, or resets a legacy storage file', async t => {
  const originalQuery = db.query;
  process.env.DATABASE_URL = 'postgres://storage-test';
  const legacy = JSON.stringify({ san: 'Legacy venue' });
  fs.writeFileSync(process.env.BOT_STATE_FILE, legacy);
  let row = null;
  let fail = false;
  db.query = async statement => {
    const sql = String(statement);
    if (fail) throw new Error('database unavailable');
    if (sql.includes('FROM storage')) return { rows: row ? [row] : [] };
    return { rows: [] };
  };
  t.after(() => {
    db.query = originalQuery;
    delete process.env.DATABASE_URL;
  });
  assert.equal((await readBotStorage()).san, null);
  row = { san: 'Database venue' };
  assert.equal((await readBotStorage()).san, 'Database venue');
  await writeBotStorage({ san: 'New venue' });
  await resetBotStorage();
  assert.equal(fs.readFileSync(process.env.BOT_STATE_FILE, 'utf8'), legacy);
  fail = true;
  for (const operation of [
    readBotStorage,
    () => writeBotStorage({}),
    resetBotStorage,
  ]) {
    await assert.rejects(operation, /database unavailable/);
  }
  assert.equal(fs.readFileSync(process.env.BOT_STATE_FILE, 'utf8'), legacy);
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
