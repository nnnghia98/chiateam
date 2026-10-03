const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  startManagedSupervisor,
  childEnvironment,
  shouldDelegate,
} = require('./managed-bootstrap');
function fixture(service = 'telegram') {
  let snapshot = {
    version: 0,
    env: {
      TELEGRAM_BOT_TOKEN: 'token',
      ZALO_MODE: 'polling',
      TELEGRAM_COMMAND_RULES: { team: { enabled: false } },
    },
    restartGeneration: 0,
  };
  let granted = true;
  const calls = [],
    children = [];
  const client = {
    getSettings: async () => snapshot,
    report: async p => calls.push(['report', p]),
    lease: async (id, action) => {
      calls.push(['lease', action]);
      return { granted, expiresAt: new Date(Date.now() + 30000).toISOString() };
    },
  };
  const fork = (_file, _args, options) => {
    const child = new EventEmitter();
    child.options = options;
    child.kill = () =>
      queueMicrotask(() => {
        calls.push(['exit']);
        child.emit('exit', 0);
      });
    child.send = () => {};
    children.push(child);
    calls.push(['fork']);
    queueMicrotask(() => child.emit('message', { type: 'ready', service }));
    return child;
  };
  const runtime = startManagedSupervisor({
    service,
    entrypoint: __filename,
    env: {
      MANAGEMENT_TELEGRAM_TOKEN: 'scoped',
      MANAGEMENT_ENCRYPTION_KEY: 'never-child',
    },
    runtimeClient: client,
    forkImpl: fork,
    refreshMs: 60000,
    installSignals: false,
    logger: { error() {} },
    supervisorOptions: { readyTimeoutMs: 50, stopTimeoutMs: 20 },
  });
  return {
    runtime,
    calls,
    children,
    setSnapshot: v => {
      snapshot = v;
    },
    deny: () => {
      granted = false;
    },
  };
}
test('initial active version zero starts and later apply/restart rebuild clients', async () => {
  const f = fixture();
  try {
    await f.runtime.ready;
    assert.equal(f.runtime.getState().appliedVersion, 0);
    assert.equal(
      f.children[0].options.env.TELEGRAM_COMMAND_RULES,
      '{"team":{"enabled":false}}'
    );
    assert.equal(
      f.children[0].options.env.MANAGEMENT_ENCRYPTION_KEY,
      undefined
    );
    f.setSnapshot({
      version: 2,
      env: { TELEGRAM_BOT_TOKEN: 'new' },
      restartGeneration: 0,
    });
    await f.runtime.tick();
    assert.equal(f.children.length, 2);
    assert.equal(f.runtime.getState().appliedVersion, 2);
    assert.ok(
      f.calls.findIndex(c => c[0] === 'exit') <
        f.calls.map(c => c[0]).lastIndexOf('fork')
    );
    f.setSnapshot({
      version: 2,
      env: { TELEGRAM_BOT_TOKEN: 'new' },
      restartGeneration: 1,
    });
    await f.runtime.tick();
    assert.equal(f.children.length, 3);
  } finally {
    await f.runtime.stop();
  }
});
test('lost polling lease stops the receiver before any new child starts', async () => {
  const f = fixture();
  try {
    await f.runtime.ready;
    f.deny();
    await f.runtime.tick();
    assert.equal(f.runtime.getState().running, false);
    assert.equal(f.children.length, 1);
  } finally {
    await f.runtime.stop();
  }
});
test('quiesce state stops receiver and reports stopped', async () => {
  const f = fixture();
  try {
    await f.runtime.ready;
    f.setSnapshot({
      version: 0,
      env: { TELEGRAM_BOT_TOKEN: 'token' },
      desiredState: 'stopped',
    });
    await f.runtime.tick();
    assert.equal(f.runtime.getState().running, false);
    assert.ok(f.calls.some(c => c[0] === 'report' && c[1].state === 'stopped'));
  } finally {
    await f.runtime.stop();
  }
});
test('service environment scopes credentials, removes tokens and maps changed API addresses', () => {
  const env = childEnvironment(
    'telegram',
    {
      env: {
        TELEGRAM_BOT_TOKEN: '',
        TELEGRAM_API_URL: 'https://new.test/api',
        INTERNAL_API_AUTH_TOKEN: 'new',
      },
    },
    {
      TELEGRAM_BOT_TOKEN: 'old',
      MANAGEMENT_ADMIN_TOKEN: 'never',
      MANAGEMENT_TELEGRAM_TOKEN: 'own',
      TYPESAFE_API_KEY: 'jev-test-key',
      TYPESAFE_MODEL: 'jev-latest',
      TELEGRAM_JEV_ENABLED: 'true',
    }
  );
  assert.equal(env.TELEGRAM_BOT_TOKEN, '');
  assert.equal(env.API_INTERNAL_URL, 'https://new.test/api');
  assert.equal(env.MANAGEMENT_ADMIN_TOKEN, undefined);
  assert.equal(env.MANAGEMENT_TELEGRAM_TOKEN, 'own');
  assert.equal(env.TYPESAFE_API_KEY, 'jev-test-key');
  assert.equal(env.TYPESAFE_MODEL, 'jev-latest');
  assert.equal(env.TELEGRAM_JEV_ENABLED, 'true');
  assert.equal(
    childEnvironment(
      'zalo-polling',
      { env: {} },
      { TYPESAFE_API_KEY: 'jev-test-key' }
    ).TYPESAFE_API_KEY,
    undefined
  );
  assert.equal(shouldDelegate({ MANAGEMENT_BOOTSTRAP: 'true' }), true);
});

test('lease renews while a slow child is starting and excludes a second receiver', async () => {
  let expires = 0,
    renewals = 0;
  const client = {
    getSettings: async () => ({
      version: 0,
      env: { TELEGRAM_BOT_TOKEN: 'test' },
    }),
    report: async () => {},
    lease: async (_id, action) => {
      if (action === 'release') {
        expires = 0;
        return { granted: true };
      }
      if (action === 'renew') renewals++;
      expires = Date.now() + 25;
      return { granted: true, expiresAt: new Date(expires).toISOString() };
    },
  };
  const fork = () => {
    const child = new EventEmitter();
    const ready = setTimeout(
      () => child.emit('message', { type: 'ready', service: 'telegram' }),
      70
    );
    child.kill = () => {
      clearTimeout(ready);
      queueMicrotask(() => child.emit('exit', 0));
    };
    child.send = () => {};
    return child;
  };
  const runtime = startManagedSupervisor({
    service: 'telegram',
    entrypoint: __filename,
    runtimeClient: client,
    forkImpl: fork,
    refreshMs: 5,
    installSignals: false,
    logger: { error() {} },
    supervisorOptions: { readyTimeoutMs: 100, stopTimeoutMs: 5 },
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 45));
    assert.ok(renewals >= 2);
    assert.ok(
      expires > Date.now(),
      'second receiver must still see an owned lease'
    );
    await runtime.ready;
  } finally {
    await runtime.stop();
  }
});

test('removing the managed database stops API rather than starting a default database connection', async () => {
  let snapshot = {
    version: 0,
    env: {
      DATABASE_URL: 'postgres://fake.test/app',
      INTERNAL_API_AUTH_TOKEN: 'fake',
    },
  };
  const children = [],
    reports = [];
  const runtime = startManagedSupervisor({
    service: 'api',
    entrypoint: __filename,
    runtimeClient: {
      getSettings: async () => snapshot,
      report: async value => reports.push(value),
      lease: async () => ({ granted: true }),
    },
    forkImpl: () => {
      const child = new EventEmitter();
      children.push(child);
      child.send = () => {};
      child.kill = () => queueMicrotask(() => child.emit('exit', 0));
      queueMicrotask(() =>
        child.emit('message', { type: 'ready', service: 'api' })
      );
      return child;
    },
    installSignals: false,
    refreshMs: 60000,
    logger: { error() {} },
    supervisorOptions: { readyTimeoutMs: 100, stopTimeoutMs: 10 },
  });
  try {
    await runtime.ready;
    assert.equal(children.length, 1);
    snapshot = {
      version: 1,
      env: { DATABASE_URL: '', INTERNAL_API_AUTH_TOKEN: 'fake' },
    };
    await runtime.tick();
    assert.equal(children.length, 1);
    assert.equal(runtime.getState().running, false);
    assert.equal(reports.at(-1).state, 'stopped');
  } finally {
    await runtime.stop();
  }
});
