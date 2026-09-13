const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createManagementService } = require('./service');
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

test('lease cannot be released or renewed by another process', async () => {
  const s = createManagementService({ env: env(), db: fakePool() });
  assert.equal(
    (await s.lease('telegram', { instanceId: 'one', action: 'acquire' }))
      .granted,
    true
  );
  for (const action of ['acquire', 'renew', 'release'])
    assert.equal(
      (await s.lease('telegram', { instanceId: 'two', action })).granted,
      false
    );
  assert.equal(
    (await s.lease('telegram', { instanceId: 'one', action: 'release' }))
      .granted,
    true
  );
});
test('restart requires confirmation and current saved version', async () => {
  const s = createManagementService({ env: env(), db: fakePool() });
  assert.equal(
    (await s.restart({ service: 'telegram', expectedVersion: 0 })).code,
    'CONFIRM_REQUIRED'
  );
  assert.equal(
    (
      await s.restart({
        service: 'telegram',
        expectedVersion: 1,
        confirm: true,
      })
    ).code,
    'STALE_VERSION'
  );
  const result = await s.restart({
    service: 'telegram',
    expectedVersion: 0,
    confirm: true,
  });
  assert.equal(
    result.services.find(x => x.id === 'telegram').restartGeneration,
    1
  );
});
test('stale or failed reports never claim a new applied version', async () => {
  const s = createManagementService({ env: env(), db: fakePool() });
  assert.equal(
    (await s.report('telegram', { version: 42, state: 'applied' })).code,
    'STALE_REPORT'
  );
  await s.report('telegram', { version: 0, state: 'applied' });
  await s.report('telegram', { version: 0, state: 'failed' });
  assert.equal(
    (await s.snapshot()).services.find(x => x.id === 'telegram').appliedVersion,
    0
  );
});

test('candidate test resolves the saved draft secret and enforces expectedVersion', async () => {
  const calls = [];
  const s = createManagementService({
    env: env(),
    db: fakePool(),
    testImpl: async (target, options) => {
      calls.push({ target, env: options.env });
      return { ok: true, target, checkedAt: 'now' };
    },
  });
  const saved = await s.save(
    {
      expectedVersion: 0,
      confirm: true,
      secrets: {
        TELEGRAM_BOT_TOKEN: { action: 'replace', value: 'managed-token' },
      },
    },
    'admin'
  );
  assert.equal(saved.version, 1);
  assert.equal(
    (await s.test({ expectedVersion: 0, target: 'telegram' })).code,
    'STALE_VERSION'
  );
  assert.equal(
    (await s.test({ expectedVersion: 1, target: 'telegram' })).ok,
    true
  );
  assert.equal(calls[0].env.TELEGRAM_BOT_TOKEN, 'managed-token');
});

test('failed candidate test prevents apply and leaves active version unchanged', async () => {
  let valid = true;
  const s = createManagementService({
    env: env(),
    db: fakePool(),
    testImpl: async target => ({
      ok: valid,
      target,
      errorCode: valid ? undefined : 'PROVIDER_CHECK_FAILED',
    }),
  });
  await s.save(
    {
      expectedVersion: 0,
      confirm: true,
      secrets: {
        TELEGRAM_BOT_TOKEN: { action: 'replace', value: 'bad-token' },
      },
    },
    'admin'
  );
  valid = false;
  const result = await s.apply({ expectedVersion: 1, confirm: true }, 'admin');
  assert.equal(result.code, 'CANDIDATE_TEST_FAILED');
  assert.equal((await s.snapshot()).activeVersion, 0);
});

test('operations receive active managed credentials and quiesce hook', async () => {
  let received;
  const s = createManagementService({
    env: env(),
    db: fakePool(),
    testImpl: async target => ({ ok: true, target }),
    operationImpl: async (action, body, options) => {
      received = options;
      return { ok: true, action };
    },
    quiesce: async () => true,
  });
  await s.save(
    {
      expectedVersion: 0,
      confirm: true,
      secrets: { ZALO_BOT_TOKEN: { action: 'replace', value: 'managed-zalo' } },
    },
    'admin'
  );
  await s.apply({ expectedVersion: 1, confirm: true }, 'admin');
  const result = await s.operation('webhook-info', {}, 'admin');
  assert.equal(result.ok, true);
  assert.equal(received.env.ZALO_BOT_TOKEN, 'managed-zalo');
  assert.equal(typeof received.quiesce, 'function');
});

test('runtime snapshots deliver only the secrets actually needed by each consumer', async () => {
  const e = {
    ...env(),
    ZALO_BOT_TOKEN: 'zalo-secret',
    INTERNAL_API_AUTH_TOKEN: 'api-secret',
    DATABASE_URL: 'postgres://db.test/app',
    SUPABASE_SERVICE_ROLE_KEY: 'storage-secret',
  };
  const s = createManagementService({ env: e, db: fakePool() });
  const telegram = (await s.runtime('telegram')).env,
    api = (await s.runtime('api')).env,
    admin = (await s.runtime('admin')).env;
  assert.equal(telegram.TELEGRAM_BOT_TOKEN, 'env-secret');
  assert.equal(telegram.ZALO_BOT_TOKEN, 'zalo-secret');
  assert.equal(telegram.DATABASE_URL, undefined);
  assert.equal(api.DATABASE_URL, 'postgres://db.test/app');
  assert.equal(api.TELEGRAM_BOT_TOKEN, undefined);
  assert.equal(api.ZALO_BOT_TOKEN, undefined);
  assert.equal(admin.INTERNAL_API_AUTH_TOKEN, 'api-secret');
  assert.equal(admin.TELEGRAM_BOT_TOKEN, undefined);
  assert.equal(admin.DATABASE_URL, undefined);
});
test('mode switching blocks a new polling receiver until the webhook lease is released', async () => {
  const s = createManagementService({
    env: { ...env(), ZALO_MODE: 'webhook' },
    db: fakePool(),
  });
  assert.equal(
    (
      await s.lease('zalo-webhook', {
        instanceId: 'webhook',
        action: 'acquire',
      })
    ).granted,
    true
  );
  await s.store.save({ expectedVersion: 0, changes: { ZALO_MODE: 'polling' } });
  await s.store.apply(1, 'test');
  assert.equal(
    (await s.lease('zalo-polling', { instanceId: 'poller', action: 'acquire' }))
      .granted,
    false
  );
  await s.lease('zalo-webhook', { instanceId: 'webhook', action: 'release' });
  assert.equal(
    (await s.lease('zalo-polling', { instanceId: 'poller', action: 'acquire' }))
      .granted,
    true
  );
});

test('database apply drains old API and blocks data actions until new API is ready', async () => {
  const e = {
    ...env(),
    DATABASE_URL: 'postgres://old.db/app',
    MANAGEMENT_ALLOWED_DATABASE_HOSTS: 'old.db,new.db',
  };
  let operations = 0;
  const service = createManagementService({
    env: e,
    db: fakePool(),
    testImpl: async target => ({ ok: true, target }),
    operationImpl: async () => {
      operations++;
      return { ok: true };
    },
  });
  await service.report('api', {
    version: 0,
    state: 'applied',
    instanceId: 'old-api',
  });
  await service.lease('api', { instanceId: 'old-api', action: 'acquire' });
  await service.save(
    {
      expectedVersion: 0,
      confirm: true,
      secrets: {
        DATABASE_URL: { action: 'replace', value: 'postgres://new.db/app' },
      },
    },
    'admin'
  );
  const pending = service.apply(
    { expectedVersion: 1, confirm: true, backupConfirmed: true },
    'admin'
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await service.snapshot()).activeVersion, 0);
  assert.equal((await service.runtime('api')).desiredState, 'stopped');
  assert.equal(
    (
      await service.restart({
        expectedVersion: 1,
        service: 'api',
        confirm: true,
      })
    ).code,
    'STORAGE_TRANSITION_PENDING'
  );
  assert.equal(
    (
      await service.save({
        expectedVersion: 1,
        changes: { DEBUG_LOGGING: true },
      })
    ).code,
    'STORAGE_TRANSITION_PENDING'
  );
  assert.equal(
    (await service.operation('webhook-info', {}, 'admin')).code,
    'STORAGE_TRANSITION_PENDING'
  );
  await service.report('api', {
    version: 0,
    state: 'stopped',
    instanceId: 'old-api',
  });
  await service.lease('api', { instanceId: 'old-api', action: 'release' });
  assert.equal((await pending).activeVersion, 1);
  assert.equal(
    (await service.operation('webhook-info', {}, 'admin')).code,
    'STORAGE_TRANSITION_PENDING'
  );
  assert.equal(operations, 0);
  await service.report('api', {
    version: 1,
    state: 'applied',
    instanceId: 'new-api',
  });
  assert.equal((await service.operation('webhook-info', {}, 'admin')).ok, true);
  assert.equal(operations, 1);
  assert.equal(
    (await service.rollback({ expectedVersion: 1, confirm: true }, 'admin'))
      .code,
    'BACKUP_REQUIRED'
  );
  await service.lease('api', { instanceId: 'new-api', action: 'acquire' });
  const rollback = service.rollback(
    { expectedVersion: 1, confirm: true, backupConfirmed: true },
    'admin'
  );
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await service.snapshot()).activeVersion, 1);
  await service.report('api', {
    version: 1,
    state: 'stopped',
    instanceId: 'new-api',
  });
  await service.lease('api', { instanceId: 'new-api', action: 'release' });
  assert.equal((await rollback).activeVersion, 0);
  assert.equal(
    (await service.operation('webhook-info', {}, 'admin')).code,
    'STORAGE_TRANSITION_PENDING'
  );
  await service.report('api', {
    version: 0,
    state: 'applied',
    instanceId: 'restored-api',
  });
  assert.equal((await service.operation('webhook-info', {}, 'admin')).ok, true);
});
