const test = require('node:test');
const assert = require('node:assert/strict');

const { createUiApiServer } = require('./server');

let server;
let baseUrl;

test.before(async () => {
  server = createUiApiServer({ getStatus: () => ({}) });
  const { port } = await server.start(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await server.stop();
});

test('all World Cup prediction API paths are frozen', async () => {
  const requests = [
    { method: 'GET', path: '/api/world-cup-predictions' },
    { method: 'GET', path: '/api/world-cup-predictions/matches/1' },
    { method: 'POST', path: '/api/world-cup-predictions/matches' },
    {
      method: 'PUT',
      path: '/api/world-cup-predictions/member/key/predictions/1',
    },
    { method: 'DELETE', path: '/api/world-cup-predictions/unknown' },
  ];

  for (const { method, path } of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
    });

    assert.equal(response.status, 410, `${method} ${path}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      error: 'WORLD_CUP_PREDICTIONS_API_FROZEN',
      message: 'World Cup prediction APIs are frozen',
    });
  }
});
