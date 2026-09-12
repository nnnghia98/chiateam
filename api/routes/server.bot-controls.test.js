const test = require('node:test');
const assert = require('node:assert/strict');

const AUTH_TOKEN = 'bot-controls-test-token';
let application;
let baseUrl;
let listCalls = 0;
let saveCalls = 0;
let checkCalls = 0;

test.before(async () => {
  process.env.INTERNAL_API_AUTH_TOKEN = AUTH_TOKEN;
  process.env.NODE_ENV = 'test';
  process.env.MAINTENANCE_MODE = 'true';
  const { createUiApiServer } = require('./server');
  application = createUiApiServer({
    botControlsService: {
      async list() {
        listCalls += 1;
        return [{ platform: 'telegram', commandsEnabled: true, lastCommandAt: null, mode: null, updatedAt: null }, { platform: 'zalo', commandsEnabled: false, lastCommandAt: null, mode: 'webhook', updatedAt: null }];
      },
      async save(platform, commandsEnabled) {
        saveCalls += 1;
        return { ok: true, control: { platform, commandsEnabled, lastCommandAt: null, mode: null, updatedAt: '2026-09-10T00:00:00.000Z' } };
      },
      async check(platform, mode) {
        checkCalls += 1;
        return { ok: true, allowed: true, control: { platform, commandsEnabled: true, lastCommandAt: '2026-09-10T00:00:00.000Z', mode, updatedAt: null } };
      },
    },
  });
  const started = await application.start(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${started.port}`;
});

test.after(async () => {
  await application?.stop();
  delete process.env.MAINTENANCE_MODE;
});

function request(path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const adminHeaders = { 'x-internal-api-auth': AUTH_TOKEN, 'x-admin-role': 'admin' };

test('admin controls remain reachable during maintenance and GET has no activity side effect', async () => {
  const response = await request('/api/bot-controls', undefined, adminHeaders);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(listCalls, 1);
  assert.equal(checkCalls, 0);
});

test('save requires admin and rejects extra fields', async () => {
  const viewer = await request('/api/bot-controls/telegram', { commandsEnabled: false }, { ...adminHeaders, 'x-admin-role': 'viewer' });
  assert.equal(viewer.status, 403);
  const invalid = await request('/api/bot-controls/telegram', { commandsEnabled: false, extra: true }, adminHeaders);
  assert.equal(invalid.status, 400);
  assert.equal(saveCalls, 0);
});

test('runtime check accepts token without role and rejects role headers', async () => {
  const denied = await request('/api/bot-controls/telegram/check', { mode: 'polling' }, adminHeaders);
  assert.equal(denied.status, 401);
  const accepted = await request('/api/bot-controls/telegram/check', { mode: 'polling' }, { 'x-internal-api-auth': AUTH_TOKEN });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { platform: 'telegram', commandsEnabled: true, lastCommandAt: '2026-09-10T00:00:00.000Z', mode: 'polling', updatedAt: null });
  assert.equal(checkCalls, 1);
});

test('read access and invalid control values are rejected before service calls', async () => {
  const privateRead = await request('/api/bot-controls', undefined, { ...adminHeaders, 'x-admin-role': 'viewer' });
  assert.equal(privateRead.status, 403);
  const savesBefore = saveCalls;
  const checksBefore = checkCalls;
  for (const [path, body, headers] of [
    ['/api/bot-controls/telegram', { commandsEnabled: 'false' }, adminHeaders],
    ['/api/bot-controls/messenger', { commandsEnabled: true }, adminHeaders],
    ['/api/bot-controls/zalo', { commandsEnabled: null }, adminHeaders],
    ['/api/bot-controls/zalo/check', { mode: 'unknown' }, { 'x-internal-api-auth': AUTH_TOKEN }],
    ['/api/bot-controls/zalo/check', { mode: 'webhook', extra: true }, { 'x-internal-api-auth': AUTH_TOKEN }],
  ]) {
    assert.equal((await request(path, body, headers)).status, 400);
  }
  assert.equal(saveCalls, savesBefore);
  assert.equal(checkCalls, checksBefore);
  const noAuth = await request('/api/bot-controls/zalo/check', { mode: 'webhook' });
  assert.equal(noAuth.status, 401);
});

test('admin save returns the selected platform and status is uncached', async () => {
  const response = await request('/api/bot-controls/zalo', { commandsEnabled: false }, adminHeaders);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.platform, 'zalo');
  assert.equal(saved.commandsEnabled, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/api/status')).headers.get('cache-control'), 'no-store');
});
