const test = require('node:test');
const assert = require('node:assert/strict');

const AUTH_TOKEN = 'webhook-event-test-token';
const previousEnvironment = {
  INTERNAL_API_AUTH_TOKEN: process.env.INTERNAL_API_AUTH_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
};
let application;
let baseUrl;
const calls = [];

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test.before(async () => {
  process.env.INTERNAL_API_AUTH_TOKEN = AUTH_TOKEN;
  process.env.NODE_ENV = 'test';

  const { createUiApiServer } = require('./server');
  application = createUiApiServer({
    webhookEventService: {
      async claim(payload) {
        calls.push(['claim', payload]);
        return { ok: true, state: 'claimed', claimId: 'claim-1' };
      },
      async complete(payload) {
        calls.push(['complete', payload]);
        return { ok: false, code: 'INVALID_CLAIM_ID' };
      },
      async release(payload) {
        calls.push(['release', payload]);
        throw new Error('database unavailable');
      },
    },
  });
  const { port } = await application.start(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await application?.stop();
  restoreEnvironment(
    'INTERNAL_API_AUTH_TOKEN',
    previousEnvironment.INTERNAL_API_AUTH_TOKEN
  );
  restoreEnvironment('NODE_ENV', previousEnvironment.NODE_ENV);
});

function post(path, body, { authenticated = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (authenticated) {
    headers['x-internal-api-auth'] = AUTH_TOKEN;
    headers['x-admin-role'] = 'admin';
  }

  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('webhook event routes require internal admin authentication', async () => {
  const response = await post(
    '/api/webhook-events/claim',
    { platform: 'zalo', eventId: 'event-1' },
    { authenticated: false }
  );

  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('webhook event routes map lifecycle service results', async () => {
  const claim = await post('/api/webhook-events/claim', {
    platform: 'zalo',
    eventId: 'event-1',
  });
  assert.equal(claim.status, 200);
  assert.deepEqual(await claim.json(), {
    ok: true,
    state: 'claimed',
    claimId: 'claim-1',
  });

  const complete = await post('/api/webhook-events/complete', {
    platform: 'zalo',
    eventId: 'event-1',
    claimId: '',
  });
  assert.equal(complete.status, 400);
  assert.deepEqual(await complete.json(), { error: 'INVALID_CLAIM_ID' });

  const release = await post('/api/webhook-events/release', {
    platform: 'zalo',
    eventId: 'event-1',
    claimId: 'claim-1',
  });
  assert.equal(release.status, 500);
  assert.deepEqual(await release.json(), {
    error: 'Failed to update webhook event',
  });
});
