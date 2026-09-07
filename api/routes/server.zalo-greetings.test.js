const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createZaloGreetingService,
} = require('../services/zalo-greeting-service');

test('greeting HTTP claims require internal admin auth and hide storage failures', async t => {
  const previous = process.env.INTERNAL_API_AUTH_TOKEN;
  process.env.INTERNAL_API_AUTH_TOKEN = 'greeting-test-token';
  t.after(() => {
    if (previous == null) delete process.env.INTERNAL_API_AUTH_TOKEN;
    else process.env.INTERNAL_API_AUTH_TOKEN = previous;
  });
  const calls = [];
  let fail = false;
  const { createUiApiServer } = require('./server');
  const app = createUiApiServer({
    zaloGreetingService: createZaloGreetingService({
      repository: {
        claim: async identity => {
          if (fail) throw new Error('private database details');
          calls.push(identity);
          return true;
        },
      },
    }),
  });
  const { port } = await app.start(0, '127.0.0.1');
  t.after(() => app.stop());
  const call = ({
    token = 'greeting-test-token',
    role = 'admin',
    body = '{"userId":"u","chatId":"c","chatType":"private"}',
  } = {}) =>
    fetch(`http://127.0.0.1:${port}/api/zalo-greetings/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-auth': token,
        'x-admin-role': role,
      },
      body,
    });
  assert.equal((await call({ token: '' })).status, 403);
  assert.equal((await call({ role: 'viewer' })).status, 403);
  assert.equal((await call({ body: '{broken' })).status, 400);
  assert.equal((await call({ body: '{}' })).status, 400);
  assert.equal(calls.length, 0);
  const result = await call();
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, claimed: true });
  assert.deepEqual(calls, [{ userId: 'u', chatId: 'c' }]);
  fail = true;
  const failure = await call();
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /private database details/);
});
