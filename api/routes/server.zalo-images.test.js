const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createUiApiServer } = require('./server');

const TOKEN = 'zalo-image-test-token';
const validImage = {
  dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64'),
  contentType: 'image/png',
};

let server;
let port;

test.before(async () => {
  process.env.INTERNAL_API_AUTH_TOKEN = TOKEN;
  server = createUiApiServer({
    getStatus: () => ({}),
    zaloImageStorageService: {
      uploadImage: async payload => ({
        photoUrl: `https://cdn.test/${payload.contentType}`,
      }),
    },
  });
  ({ port } = await server.start(0, '127.0.0.1'));
});

test.after(async () => server.stop());

function request({ headers = {}, body, rawBody, method = 'POST' } = {}) {
  return new Promise((resolve, reject) => {
    const data = rawBody ?? (body == null ? null : JSON.stringify(body));
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: '/api/zalo-announcements/upload-image',
        headers: {
          Connection: 'close',
          ...headers,
          ...(data == null
            ? {}
            : {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
              }),
        },
      },
      res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          text += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: text ? JSON.parse(text) : null,
          })
        );
      }
    );
    req.on('error', reject);
    if (data != null) req.write(data);
    req.end();
  });
}

function auth(role) {
  return { 'x-internal-api-auth': TOKEN, 'x-admin-role': role };
}

test('image upload requires authentication and admin role', async () => {
  assert.equal((await request({ body: validImage })).status, 403);
  assert.equal(
    (await request({ headers: auth('viewer'), body: validImage })).status,
    403
  );
  const response = await request({ headers: auth('admin'), body: validImage });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    result: { photoUrl: 'https://cdn.test/image/png' },
  });
});

test('image upload returns safe validation and provider errors', async t => {
  const cases = [
    [
      'invalid JSON',
      { headers: auth('admin'), rawBody: '{' },
      400,
      'INVALID_JSON',
    ],
    [
      'oversized body',
      { headers: auth('admin'), rawBody: 'x'.repeat(7_200_000) },
      413,
      'IMAGE_TOO_LARGE',
    ],
  ];
  for (const [name, options, status, code] of cases) {
    await t.test(name, async () => {
      const response = await request(options);
      assert.equal(response.status, status);
      assert.deepEqual(response.body, { error: code });
    });
  }

  for (const [code, status] of [
    ['STORAGE_BUCKET_PRIVATE', 503],
    ['STORAGE_BUCKET_UNAVAILABLE', 503],
    ['IMAGE_UPLOAD_FAILED', 503],
  ]) {
    await t.test(`${code} is sanitized`, async () => {
      const failing = createUiApiServer({
        getStatus: () => ({}),
        zaloImageStorageService: {
          uploadImage: async () => {
            throw Object.assign(new Error('secret'), { code });
          },
        },
      });
      const active = await failing.start(0, '127.0.0.1');
      const oldPort = port;
      port = active.port;
      const response = await request({
        headers: auth('admin'),
        body: validImage,
      });
      await failing.stop();
      port = oldPort;
      assert.equal(response.status, status);
      assert.deepEqual(response.body, { error: code });
    });
  }

  await t.test('unexpected provider error is sanitized', async () => {
    const failing = createUiApiServer({
      getStatus: () => ({}),
      zaloImageStorageService: {
        uploadImage: async () => {
          throw new Error('secret');
        },
      },
    });
    const active = await failing.start(0, '127.0.0.1');
    const oldPort = port;
    port = active.port;
    const response = await request({
      headers: auth('admin'),
      body: validImage,
    });
    await failing.stop();
    port = oldPort;
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: 'IMAGE_STORAGE_FAILED' });
  });
});
