const test = require('node:test');
const assert = require('node:assert/strict');
const { createZaloImageStorageService, decodeImage } = require('./zalo-image-storage-service');

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test('zalo image storage validates type/signature and uploads a unique public object', async () => {
  const requests = [];
  const service = createZaloImageStorageService({
    env: { SUPABASE_URL: 'https://supabase.example/', SUPABASE_SERVICE_ROLE_KEY: 'secret' },
    createId: () => 'image-id',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return options.method === 'GET' ? { ok: true, json: async () => ({ public: true }) } : { ok: true };
    },
  });
  const result = await service.uploadImage({ dataBase64: png, contentType: 'image/png' });
  assert.equal(result.photoUrl, 'https://supabase.example/storage/v1/object/public/zalo-announcements/announcements/image-id.png');
  assert.equal(requests[1].options.headers['x-upsert'], 'false');
  assert.equal(requests[1].options.body.length, 8);
  assert.throws(() => decodeImage({ dataBase64: png, contentType: 'image/jpeg' }), { code: 'INVALID_IMAGE_DATA' });
  assert.throws(() => decodeImage({ dataBase64: 'not-base64', contentType: 'image/png' }), { code: 'INVALID_IMAGE_DATA' });
});

test('zalo image storage rejects missing/private buckets and provider failures', async t => {
  const env = {
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'secret',
  };
  for (const [name, fetchImpl, code] of [
    ['missing bucket', async () => ({ ok: false }), 'STORAGE_BUCKET_UNAVAILABLE'],
    ['private bucket', async () => ({ ok: true, json: async () => ({ public: false }) }), 'STORAGE_BUCKET_PRIVATE'],
    ['provider failure', async (url, options) => options.method === 'GET' ? { ok: true, json: async () => ({ public: true }) } : { ok: false }, 'IMAGE_UPLOAD_FAILED'],
  ]) {
    await t.test(name, async () => {
      const service = createZaloImageStorageService({ env, fetchImpl });
      await assert.rejects(service.uploadImage({ dataBase64: png, contentType: 'image/png' }), { code });
    });
  }
});

test('zalo image storage converts timeout and unexpected fetch errors to safe failures', async () => {
  const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'secret' };
  const timeoutService = createZaloImageStorageService({
    env,
    timeoutMs: 1,
    fetchImpl: (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });
  await assert.rejects(timeoutService.uploadImage({ dataBase64: png, contentType: 'image/png' }), { code: 'IMAGE_UPLOAD_FAILED' });
  const failedService = createZaloImageStorageService({ env, fetchImpl: async () => { throw new Error('secret'); } });
  await assert.rejects(failedService.uploadImage({ dataBase64: png, contentType: 'image/png' }), { code: 'IMAGE_UPLOAD_FAILED' });
});

test('zalo image storage accepts a valid 5 MiB image and rejects decoded bytes above the limit', () => {
  const fiveMiB = Buffer.concat([pngBytes, Buffer.alloc(5 * 1024 * 1024 - pngBytes.length)]);
  assert.equal(decodeImage({ dataBase64: fiveMiB.toString('base64'), contentType: 'image/png' }).buffer.length, fiveMiB.length);
  const tooLarge = Buffer.concat([pngBytes, Buffer.alloc(5 * 1024 * 1024 - pngBytes.length + 1)]);
  assert.throws(() => decodeImage({ dataBase64: tooLarge.toString('base64'), contentType: 'image/png' }), { code: 'IMAGE_TOO_LARGE' });
});
