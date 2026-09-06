const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createApiZaloAnnouncementRepository,
} = require('./api-zalo-announcement-repository');

test('announcement repository calls bounded internal POST routes', async () => {
  const calls = [];
  const repository = createApiZaloAnnouncementRepository({
    request: async (path, options) => {
      calls.push({ path, ...options });
      return { ok: true, result: null };
    },
  });
  for (const method of [
    'subscribe',
    'unsubscribe',
    'prepare',
    'claim',
    'next',
    'record',
    'finish',
    'status',
    'cancel',
  ])
    await repository[method]({ id: 'example' });
  assert.equal(calls.length, 9);
  assert.ok(
    calls.every(call => call.method === 'POST' && call.timeoutMs === 15000)
  );
  assert.equal(calls[0].path, '/api/zalo-announcements/subscribe');
  const invalid = createApiZaloAnnouncementRepository({
    request: async () => ({ ok: false }),
  });
  await assert.rejects(
    invalid.status({}),
    /Invalid Zalo announcement API response/
  );
});
