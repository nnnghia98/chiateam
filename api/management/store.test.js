const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createManagementStore } = require('./store');

function fakePool() {
  const db = { row: null, lock: false, waiting: [] };
  const acquire = async () => {
    if (!db.lock) {
      db.lock = true;
      return;
    }
    await new Promise(resolve => db.waiting.push(resolve));
    db.lock = true;
  };
  const release = () => {
    const next = db.waiting.shift();
    if (next) next();
    else db.lock = false;
  };
  return {
    connect: async () => {
      let held = false;
      return {
        query: async (sql, values = []) => {
          if (/SELECT version.*FOR UPDATE/i.test(sql)) {
            await acquire();
            held = true;
            return { rows: db.row ? [db.row] : [] };
          }
          if (/INSERT INTO management_snapshots/i.test(sql)) {
            db.row = {
              version: values[0],
              active_version: values[1],
              payload: JSON.parse(values[2]),
            };
            return { rows: [] };
          }
          if (/COMMIT/i.test(sql)) {
            if (held) release();
            held = false;
            return { rows: [] };
          }
          if (/ROLLBACK/i.test(sql)) {
            if (held) release();
            held = false;
            return { rows: [] };
          }
          return { rows: [] };
        },
        release: () => {
          if (held) release();
        },
      };
    },
    db,
  };
}
function env() {
  return {
    NODE_ENV: 'test',
    MANAGEMENT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
    TELEGRAM_BOT_TOKEN: 'env-secret',
  };
}

test('private bootstrap encrypts environment secret and resolves active service', async () => {
  const p = fakePool();
  const s = createManagementStore({ env: env(), db: p });
  const raw = await s.readDraft();
  assert.equal(raw.version, 0);
  assert.equal(raw.secrets.TELEGRAM_BOT_TOKEN.configured, true);
  assert.equal(JSON.stringify(raw).includes('env-secret'), false);
  const resolved = await s.resolveActive('telegram');
  assert.equal(resolved.env.TELEGRAM_BOT_TOKEN, 'env-secret');
});

test('CAS allows one concurrent save and rejects the stale writer', async () => {
  const p = fakePool();
  const e = env();
  const a = createManagementStore({ env: e, db: p });
  const b = createManagementStore({ env: e, db: p });
  const [x, y] = await Promise.all([
    a.save({ expectedVersion: 0, changes: { CHAT_ID: '1' } }),
    b.save({ expectedVersion: 0, changes: { CHAT_ID: '2' } }),
  ]);
  assert.equal([x, y].filter(r => r.ok).length, 1);
  assert.equal([x, y].filter(r => r.code === 'STALE_VERSION').length, 1);
});

test('failed validation does not create a row or mutate state', async () => {
  const p = fakePool();
  const s = createManagementStore({ env: env(), db: p });
  const bad = await s.save({ expectedVersion: 0, changes: { UNKNOWN: 'x' } });
  assert.equal(bad.code, 'UNKNOWN_SETTING');
  assert.equal(p.db.row, null);
});

test('keep carries encrypted secret and remove leaves tombstone without env fallback', async () => {
  const p = fakePool();
  const e = env();
  const s = createManagementStore({ env: e, db: p });
  const first = await s.save({
    expectedVersion: 0,
    secrets: {
      TELEGRAM_BOT_TOKEN: { action: 'replace', value: 'managed-secret' },
    },
  });
  const second = await s.save({
    expectedVersion: 1,
    secrets: { TELEGRAM_BOT_TOKEN: { action: 'keep' } },
  });
  await s.apply(2, 'test');
  assert.equal(
    (await s.resolveActive('telegram')).env.TELEGRAM_BOT_TOKEN,
    'managed-secret'
  );
  assert.equal(second.snapshot.secrets.TELEGRAM_BOT_TOKEN.encryptionVersion, 1);
  const third = await s.save({
    expectedVersion: 2,
    secrets: { TELEGRAM_BOT_TOKEN: { action: 'remove' } },
  });
  await s.apply(3, 'test');
  assert.equal((await s.resolveActive('telegram')).env.TELEGRAM_BOT_TOKEN, '');
  assert.equal(third.snapshot.secrets.TELEGRAM_BOT_TOKEN.tombstone, true);
  assert.ok(first.snapshot.secrets.TELEGRAM_BOT_TOKEN.ciphertext);
});

test('draft and active versions are separate, then rollback returns previous active', async () => {
  const p = fakePool();
  const s = createManagementStore({ env: env(), db: p });
  await s.save({ expectedVersion: 0, changes: { CHAT_ID: 'draft' } });
  assert.equal((await s.readActive()).values.CHAT_ID, undefined);
  await s.apply(1, 'test');
  assert.equal((await s.readActive()).values.CHAT_ID, 'draft');
  await s.save({ expectedVersion: 1, changes: { CHAT_ID: 'new' } });
  await s.apply(2, 'test');
  await s.rollback(2, 'test');
  assert.equal((await s.readActive()).values.CHAT_ID, 'draft');
});

test('rollback returns last applied version, skipping saved drafts', async () => {
  const s = createManagementStore({ env: env(), db: fakePool() });
  await s.save({ expectedVersion: 0, changes: { CHAT_ID: 'first' } });
  await s.apply(1, 'test');
  await s.save({ expectedVersion: 1, changes: { CHAT_ID: 'never-applied' } });
  await s.save({ expectedVersion: 2, changes: { CHAT_ID: 'third' } });
  await s.apply(3, 'test');
  await s.rollback(3, 'test');
  assert.equal((await s.readActive()).values.CHAT_ID, 'first');
});
test('canonical secret changes encrypt and environment defaults persist after restart', async () => {
  const p = fakePool();
  const e = {
    ...env(),
    CHAT_ID: 'bootstrap-chat',
    DATABASE_URL: 'postgres://private-db',
  };
  const s = createManagementStore({ env: e, db: p });
  await s.snapshot();
  assert.equal(
    JSON.stringify(p.db.row).includes('postgres://private-db'),
    false
  );
  const restarted = createManagementStore({
    env: { ...e, CHAT_ID: 'changed-env' },
    db: p,
  });
  assert.equal((await restarted.readActive()).values.CHAT_ID, 'bootstrap-chat');
  const saved = await restarted.save({
    expectedVersion: 0,
    changes: { TELEGRAM_BOT_TOKEN: { action: 'replace', value: 'candidate' } },
  });
  assert.equal(saved.ok, true);
  assert.equal(JSON.stringify(p.db.row).includes('candidate'), false);
});

test('store rejects credential destinations and hidden plaintext objects', async () => {
  const s = createManagementStore({
    env: { ...env(), MANAGEMENT_ALLOWED_ORIGINS: 'https://safe.test' },
    db: fakePool(),
  });
  assert.equal(
    (
      await s.save({
        expectedVersion: 0,
        changes: { TELEGRAM_API_URL: 'https://evil.test/api' },
      })
    ).code,
    'DESTINATION_NOT_ALLOWED'
  );
  assert.equal(
    (
      await s.save({
        expectedVersion: 0,
        changes: { CHAT_ID: { token: 'hidden' } },
      })
    ).code,
    'INVALID_VALUE'
  );
  assert.equal(
    (
      await s.save({
        expectedVersion: 0,
        changes: { ZALO_COMMAND_RULES: { unsubscribe: { enabled: false } } },
      })
    ).code,
    'UNSUBSCRIBE_REQUIRED'
  );
  assert.equal(
    (
      await s.save({
        expectedVersion: 0,
        changes: { TELEGRAM_API_URL: 'https://safe.test/api' },
      })
    ).ok,
    true
  );
});
