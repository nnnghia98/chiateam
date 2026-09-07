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
  const profileCalls = [];
  const { createUiApiServer } = require('./server');
  const app = createUiApiServer({
    zaloAnnouncementService: {
      subscribers: async () => ({
        ok: true,
        result: { subscribers: [{ displayName: 'Private name' }] },
      }),
      refreshSubscriber: async payload => {
        profileCalls.push(payload);
        return { ok: true, result: { updated: true } };
      },
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
  for (const operation of ['subscribers', 'refreshSubscriber']) {
    assert.equal((await call(operation, { token: '' })).status, 403);
    const denied = await call(operation, { role: 'viewer' });
    assert.equal(denied.status, 403);
    assert.doesNotMatch(await denied.text(), /Private name/);
  }
  assert.equal(profileCalls.length, 0);
  const list = await call('subscribers');
  assert.equal(list.status, 200);
  assert.match(await list.text(), /Private name/);
  assert.equal(
    (await call('refreshSubscriber', { body: '{"displayName":"Nghĩa"}' }))
      .status,
    200
  );
  assert.deepEqual(profileCalls, [{ displayName: 'Nghĩa' }]);
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
