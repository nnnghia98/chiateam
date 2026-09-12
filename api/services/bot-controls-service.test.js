const test = require('node:test');
const assert = require('node:assert/strict');

const { createBotControlsService } = require('./bot-controls-service');

function createFakeDb() {
  const rows = new Map();
  const bootstrapQueries = [];
  let failOn;
  const db = {
    rows,
    bootstrapQueries,
    failOn(value) { failOn = value; },
    async connect() {
      return {
        async query(statement) {
          bootstrapQueries.push(String(statement));
          if (failOn && String(statement).includes(failOn)) throw new Error('bootstrap failed');
          return { rows: [] };
        },
        release() {},
      };
    },
    async query(statement, values = []) {
      const sql = String(statement);
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('SELECT')) {
        return {
          rows: [...rows].map(([platform, row]) => ({ platform, ...row })),
        };
      }
      const platform = values[0];
      const previous = rows.get(platform);
      const isSave = sql.includes(
        'INSERT INTO bot_controls (platform, commands_enabled'
      );
      const row = {
        commands_enabled:
          isSave && values.length > 1
            ? values[1]
            : previous?.commands_enabled ?? true,
        last_command_at: !isSave
          ? values[1]
          : previous?.last_command_at ?? null,
        mode: !isSave
          ? values[2]
          : previous?.mode ?? null,
        updated_at: isSave ? values[2] : previous?.updated_at ?? null,
      };
      rows.set(platform, row);
      return { rows: [{ platform, ...row }] };
    },
  };
  return db;
}

test('controls persist across service instances and platform updates are independent', async () => {
  const db = createFakeDb();
  const first = createBotControlsService({ db });

  assert.deepEqual(await first.list(), [
    { platform: 'telegram', commandsEnabled: true, lastCommandAt: null, mode: null, updatedAt: null },
    { platform: 'zalo', commandsEnabled: true, lastCommandAt: null, mode: null, updatedAt: null },
  ]);
  await first.save('telegram', false);

  const second = createBotControlsService({ db });
  const controls = await second.list();
  assert.equal(controls.find(value => value.platform === 'telegram').commandsEnabled, false);
  assert.equal(controls.find(value => value.platform === 'zalo').commandsEnabled, true);
});

test('runtime checks record activity while paused and report command permission', async () => {
  const db = createFakeDb();
  const service = createBotControlsService({
    db,
    clock: () => new Date('2026-09-10T00:00:00.000Z'),
  });

  await service.save('zalo', false);
  const result = await service.check('zalo', 'webhook');

  assert.equal(result.allowed, false);
  assert.equal(result.control.commandsEnabled, false);
  assert.equal(result.control.mode, 'webhook');
  assert.equal(result.control.lastCommandAt.toISOString(), '2026-09-10T00:00:00.000Z');
});

test('bootstrap secures controls in one transaction and retries after failure', async () => {
  const db = createFakeDb();
  db.failOn('ENABLE ROW LEVEL SECURITY');
  const service = createBotControlsService({ db });
  await assert.rejects(service.list, /bootstrap failed/);
  db.failOn(null);
  await service.list();
  const begin = db.bootstrapQueries.indexOf('BEGIN');
  const commit = db.bootstrapQueries.indexOf('COMMIT');
  assert.equal(begin >= 0, true);
  assert.equal(commit > begin, true);
  assert.match(db.bootstrapQueries.find(value => value.includes('REVOKE')), /anon/);
});

test('default service refuses database access when DATABASE_URL is absent', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const service = createBotControlsService();
  await assert.rejects(service.list, error => error.code === 'DATABASE_NOT_CONFIGURED');
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
});

test('real football reset leaves separately saved controls intact', async t => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'controls-reset-'));
  const previousUrl = process.env.DATABASE_URL;
  const previousFile = process.env.BOT_STATE_FILE;
  process.env.BOT_STATE_FILE = path.join(directory, 'storage.json');
  process.env.DATABASE_URL = 'postgres://test-only-never-connected';
  const { db: storageDb } = require('../db/config');
  const previousQuery = storageDb.query;
  const resetQueries = [];
  storageDb.query = async (sql) => {
    resetQueries.push(String(sql));
    assert.doesNotMatch(String(sql), /bot_controls/i);
    return { rows: [] };
  };
  t.after(() => {
    storageDb.query = previousQuery;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousFile === undefined) delete process.env.BOT_STATE_FILE;
    else process.env.BOT_STATE_FILE = previousFile;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const controls = createBotControlsService({ db: createFakeDb() });
  await controls.save('telegram', false);
  const { resetBotStorage } = require('./bot-storage-service');
  await resetBotStorage();
  assert.ok(resetQueries.some(sql => /INSERT INTO storage/.test(sql)));
  assert.equal((await controls.list()).find(row => row.platform === 'telegram').commandsEnabled, false);
});
