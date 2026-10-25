const test = require('node:test');
const assert = require('node:assert/strict');

test('removed fee and bank-account routes return 404', async t => {
  const previous = {
    INTERNAL_API_AUTH_TOKEN: process.env.INTERNAL_API_AUTH_TOKEN,
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.INTERNAL_API_AUTH_TOKEN = 'removed-fee-routes-test-token';
  process.env.MAINTENANCE_MODE = 'false';
  const { createUiApiServer } = require('./server');
  const application = createUiApiServer();
  t.after(() => application.stop());
  const { port } = await application.start(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${port}`;

  for (const [method, path] of [
    ['GET', '/api/fee-accounts'],
    ['POST', '/api/hosts'],
    ['POST', '/api/hosts/1/accounts'],
    ['POST', '/api/fee-batches'],
    ['GET', '/api/fee-batches/today'],
    ['POST', '/api/fee-requests/1/claim'],
    ['POST', '/api/fee-requests/1/finish'],
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'x-internal-api-auth': 'removed-fee-routes-test-token',
        'x-admin-role': 'admin',
      },
    });
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  }
  assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
});
