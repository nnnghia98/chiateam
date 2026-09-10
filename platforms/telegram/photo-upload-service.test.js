const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_IMAGE_BYTES,
  createTelegramPhotoUploadService,
} = require('./photo-upload-service');

function response(bytes, ok = true) {
  return {
    ok,
    body: (async function* () {
      yield bytes;
    })(),
  };
}

test('Telegram photo upload downloads and stores image bytes without the bot token', async () => {
  const token = 'secret-token';
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const stored = [];
  const service = createTelegramPhotoUploadService({
    bot: { token, getFile: async id => ({ file_path: `photos/${id}.jpg` }) },
    fetcher: async (url, options) => {
      assert.match(url, new RegExp(`bot${token}/photos/file-1\\.jpg$`));
      assert.equal(options.redirect, 'error');
      return response(jpeg);
    },
    repository: {
      uploadImage: async value => {
        stored.push(value);
        return 'https://cdn.example/photo.jpg';
      },
    },
  });
  assert.deepEqual(
    await service.upload({ fileId: 'file-1', fileSize: jpeg.length }),
    { photoUrl: 'https://cdn.example/photo.jpg' }
  );
  assert.deepEqual(stored[0], {
    dataBase64: jpeg.toString('base64'),
    contentType: 'image/jpeg',
  });
  assert.equal(
    JSON.stringify(stored),
    JSON.stringify(stored).replace(token, '')
  );
});

test('Telegram photo upload rejects metadata, bytes, and unsafe files', async () => {
  const bot = {
    token: 'secret-token',
    getFile: async () => ({ file_path: 'safe/image.png' }),
  };
  const repository = {
    uploadImage: async () => 'https://cdn.example/photo.png',
  };
  const service = createTelegramPhotoUploadService({
    bot,
    repository,
    fetcher: async () => response(Buffer.alloc(MAX_IMAGE_BYTES + 1)),
  });
  await assert.rejects(
    service.upload({ fileId: 'x', fileSize: MAX_IMAGE_BYTES + 1 }),
    error => error.code === 'IMAGE_TOO_LARGE'
  );
  const invalid = createTelegramPhotoUploadService({
    bot,
    repository,
    fetcher: async () => response(Buffer.from('text')),
  });
  await assert.rejects(
    invalid.upload({ fileId: 'x' }),
    error => error.code === 'INVALID_IMAGE'
  );
  const unsafe = createTelegramPhotoUploadService({
    bot: { ...bot, getFile: async () => ({ file_path: '../secret.jpg' }) },
    repository,
    fetcher: async () => response(Buffer.alloc(0)),
  });
  await assert.rejects(
    unsafe.upload({ fileId: 'x' }),
    error => error.code === 'IMAGE_UPLOAD_FAILED'
  );
});

test('Telegram photo upload prevents redirects and never exposes download errors', async () => {
  const service = createTelegramPhotoUploadService({
    bot: {
      token: 'secret-token',
      getFile: async () => ({ file_path: 'image.jpg' }),
    },
    repository: { uploadImage: async () => 'https://cdn.example/photo.jpg' },
    fetcher: async (_url, options) => {
      assert.equal(options.redirect, 'error');
      throw new Error('redirect https://api.telegram.org/file/botsecret-token');
    },
  });
  await assert.rejects(
    service.upload({ fileId: 'x' }),
    error =>
      error.code === 'IMAGE_UPLOAD_FAILED' &&
      !error.message.includes('secret-token')
  );
});

test('Telegram photo upload aborts and cancels a stalled or oversized stream', async () => {
  let cancelled = false;
  let aborted = false;
  const service = createTelegramPhotoUploadService({
    timeoutMs: 10,
    bot: {
      token: 'secret-token',
      getFile: async () => ({ file_path: 'image.jpg' }),
    },
    repository: { uploadImage: async () => 'https://cdn.example/photo.jpg' },
    fetcher: async (_url, options) => {
      options.signal.addEventListener('abort', () => {
        aborted = true;
      });
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: () => new Promise(() => {}),
            cancel: async () => {
              cancelled = true;
            },
          }),
        },
      };
    },
  });
  await assert.rejects(
    service.upload({ fileId: 'x' }),
    error => error.code === 'IMAGE_UPLOAD_FAILED'
  );
  assert.equal(aborted, true);
  assert.equal(cancelled, true);

  const tooLarge = createTelegramPhotoUploadService({
    bot: {
      token: 'secret-token',
      getFile: async () => ({
        file_path: 'image.jpg',
        file_size: MAX_IMAGE_BYTES + 1,
      }),
    },
    repository: { uploadImage: async () => 'https://cdn.example/photo.jpg' },
    fetcher: async () => {
      throw new Error('must not download');
    },
  });
  await assert.rejects(
    tooLarge.upload({ fileId: 'x' }),
    error => error.code === 'IMAGE_TOO_LARGE'
  );
});

test('Telegram photo upload rejects a response without a stream body', async () => {
  const service = createTelegramPhotoUploadService({
    bot: {
      token: 'secret-token',
      getFile: async () => ({ file_path: 'image.jpg' }),
    },
    repository: { uploadImage: async () => 'https://cdn.example/photo.jpg' },
    fetcher: async () => ({ ok: true }),
  });
  await assert.rejects(
    service.upload({ fileId: 'x' }),
    error => error.code === 'IMAGE_UPLOAD_FAILED'
  );
});
