const test = require('node:test');
const assert = require('node:assert/strict');

test('announcement HTTP routes require trusted admin auth and reject invalid requests', async t => {
  const previous = process.env.INTERNAL_API_AUTH_TOKEN;
  process.env.INTERNAL_API_AUTH_TOKEN = 'announcement-test-auth';
  t.after(() => {
    if (previous == null) delete process.env.INTERNAL_API_AUTH_TOKEN;
    else process.env.INTERNAL_API_AUTH_TOKEN = previous;
  });
  const calls = [];
  const { createUiApiServer } = require('./server');
  const app = createUiApiServer({
    zaloAnnouncementService: {
      prepare: async payload => {
        calls.push(payload);
        return { ok: true, result: { id: 'draft', total: 2 } };
      },
      subscribe: async () => ({
        ok: false,
        code: 'INVALID_ANNOUNCEMENT_REQUEST',
      }),
      status: async () => {
        throw new Error('secret database URL');
      },
    },
  });
  const { port } = await app.start(0, '127.0.0.1');
  t.after(() => app.stop());
  const call = (
    operation,
    { role = 'admin', token = 'announcement-test-auth', body = '{}' } = {}
  ) =>
    fetch(`http://127.0.0.1:${port}/api/zalo-announcements/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-auth': token,
        'x-admin-role': role,
      },
      body,
    });
  assert.equal((await call('prepare', { token: '' })).status, 403);
  assert.equal((await call('prepare', { role: 'viewer' })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await call('unexpected')).status, 404);
  assert.equal((await call('prepare', { body: '{broken' })).status, 400);
  assert.equal((await call('subscribe')).status, 400);
  const response = await call('prepare', { body: '{"message":"Hello"}' });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ message: 'Hello' }]);
  const failure = await call('status');
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /secret database URL/);
});
