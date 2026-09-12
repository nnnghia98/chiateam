const test = require('node:test');
const assert = require('node:assert/strict');
const { createBotControlsClient, createBotControlsGate } = require('./bot-controls');

function response(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

test('bot controls client sends only trusted token and runtime mode', async () => {
  const requests = [];
  const client = createBotControlsClient({
    platform: 'telegram', mode: 'polling',
    env: { BOT_API_BASE_URL: 'api.internal', INTERNAL_API_AUTH_TOKEN: 'secret' },
    fetchImpl: async (...args) => { requests.push(args); return response(200, {
      platform: 'telegram', commandsEnabled: false, mode: 'polling', lastCommandAt: null, updatedAt: null,
    }); },
  });
  assert.equal((await client.check('bench')).commandsEnabled, false);
  assert.deepEqual(requests[0][1].headers, { 'content-type': 'application/json', 'x-internal-api-auth': 'secret' });
  assert.deepEqual(JSON.parse(requests[0][1].body), { mode: 'polling' });
  assert.equal(requests[0][1].cache, 'no-store');
});

test('outage fails closed and legacy fallback is one-way', async () => {
  let calls = 0;
  const client = createBotControlsClient({
    platform: 'zalo', mode: 'webhook',
    env: { BOT_CONTROLS_LEGACY_API: 'true', INTERNAL_API_AUTH_TOKEN: 'secret' },
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? response(404, {}) : calls === 2 ? response(200, { platform: 'zalo', commandsEnabled: true, mode: 'webhook', lastCommandAt: null, updatedAt: null }) : response(404, {});
    },
  });
  assert.equal((await client.check()).legacy, true);
  assert.equal((await client.check()).commandsEnabled, true);
  assert.equal((await client.check()).available, false);
});

test('zalo unsubscribe bypasses pause and outage after recording check', async () => {
  const checks = [];
  const gate = createBotControlsGate({
    platform: 'zalo',
    client: { check: async command => { checks.push(command); return { available: false, commandsEnabled: false }; } },
  });
  assert.equal((await gate.check({ command: 'unsubscribe' })).bypass, true);
  assert.deepEqual(checks, ['unsubscribe']);
  assert.equal((await gate.check({ command: 'bench' })).commandsEnabled, false);
});
