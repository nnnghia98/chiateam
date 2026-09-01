const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createUiApiServer } = require('./server');

const AUTH_TOKEN = 'two-nike-test-token';
const calls = [];
const twoNike = {
  id: 1,
  videoId: 'Q-FaES-lifU',
  title: 'Team entrance',
  timestampSeconds: 90,
  timestamp: '01:30',
  createdBy: 'Nghia',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

const twoNikeService = {
  async listTwoNikes(videoId) {
    calls.push(['list', videoId]);
    return { ok: true, twoNikes: [twoNike] };
  },
  async createTwoNike(payload, actor) {
    calls.push(['create', payload, actor]);
    if (!payload.title) return { ok: false, code: 'INVALID_TITLE' };
    return { ok: true, twoNike: { ...twoNike, ...payload, createdBy: actor } };
  },
};

let server;
let port;
let originalAuthToken;
let originalNodeEnv;

test.before(async () => {
  originalAuthToken = process.env.INTERNAL_API_AUTH_TOKEN;
  originalNodeEnv = process.env.NODE_ENV;
  process.env.INTERNAL_API_AUTH_TOKEN = AUTH_TOKEN;
  process.env.NODE_ENV = 'test';
  server = createUiApiServer({ getStatus: () => ({}), twoNikeService });
  ({ port } = await server.start(0, '127.0.0.1'));
});

test.after(async () => {
  await server.stop();
  if (originalAuthToken == null) delete process.env.INTERNAL_API_AUTH_TOKEN;
  else process.env.INTERNAL_API_AUTH_TOKEN = originalAuthToken;
  if (originalNodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function request({ method = 'GET', path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const rawBody = body == null ? null : JSON.stringify(body);
    const requestHeaders = { Connection: 'close', ...headers };
    if (rawBody != null) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(rawBody);
    }

    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: requestHeaders },
      res => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          responseBody += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: responseBody ? JSON.parse(responseBody) : null,
          })
        );
      }
    );
    req.on('error', reject);
    if (rawBody != null) req.write(rawBody);
    req.end();
  });
}

function authHeaders(role, name) {
  return {
    'x-internal-api-auth': AUTH_TOKEN,
    'x-admin-role': role,
    ...(name ? { 'x-admin-name': name } : {}),
  };
}

test('2nike routes require an authenticated session', async () => {
  const response = await request({ path: '/api/2nikes?videoId=Q-FaES-lifU' });
  assert.equal(response.status, 401);
});

test('viewer can list and create 2nikes', async () => {
  const listed = await request({
    path: '/api/2nikes?videoId=Q-FaES-lifU',
    headers: authHeaders('viewer'),
  });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, { twoNikes: [twoNike] });

  const payload = {
    videoId: 'Q-FaES-lifU',
    title: 'Team entrance',
    timestampSeconds: 90,
    createdBy: 'Submitted name',
  };
  const created = await request({
    method: 'POST',
    path: '/api/2nikes',
    headers: authHeaders('viewer', 'Trusted name'),
    body: payload,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.twoNike.createdBy, 'Trusted name');
  assert.deepEqual(calls.at(-1), ['create', payload, 'Trusted name']);
});

test('invalid 2nike payload returns a bad request', async () => {
  const response = await request({
    method: 'POST',
    path: '/api/2nikes',
    headers: authHeaders('viewer'),
    body: {
      videoId: 'Q-FaES-lifU',
      title: '',
      timestampSeconds: 90,
      createdBy: 'Nghia',
    },
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_TITLE');
});
