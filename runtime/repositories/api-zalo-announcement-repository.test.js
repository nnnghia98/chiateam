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
    'refreshSubscriber',
    'subscribers',
    'prepare',
    'claim',
    'next',
    'record',
    'finish',
    'status',
    'cancel',
  ])
    await repository[method]({ id: 'example' });
  assert.equal(calls.length, 11);
  assert.ok(
    calls.every(
      call =>
        call.method === 'POST' &&
        call.timeoutMs ===
          (call.path.endsWith('/refreshSubscriber') ? 2000 : 15000)
    )
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

test('announcement repository uploads images and returns a safe URL', async () => {
  const calls = [];
  const repository = createApiZaloAnnouncementRepository({
    request: async (path, options) => {
      calls.push({ path, ...options });
      return {
        ok: true,
        result: { photoUrl: 'https://cdn.example/image.jpg' },
      };
    },
  });
  assert.equal(
    await repository.uploadImage({
      dataBase64: 'abc',
      contentType: 'image/jpeg',
    }),
    'https://cdn.example/image.jpg'
  );
  assert.deepEqual(calls[0], {
    path: '/api/zalo-announcements/upload-image',
    method: 'POST',
    body: { dataBase64: 'abc', contentType: 'image/jpeg' },
    timeoutMs: 15000,
  });
  const invalid = createApiZaloAnnouncementRepository({
    request: async () => ({
      ok: true,
      result: { photoUrl: 'https://user:pass@example.com/a' },
    }),
  });
  await assert.rejects(
    invalid.uploadImage({}),
    error =>
      error.code === 'IMAGE_UPLOAD_FAILED' &&
      !error.message.includes('user:pass')
  );
});
