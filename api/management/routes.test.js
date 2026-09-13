const test = require('node:test');
const assert = require('node:assert/strict');
const { handleManagementRequest } = require('./routes');
const env = {
  MANAGEMENT_ADMIN_TOKEN: 'admin',
  MANAGEMENT_TELEGRAM_TOKEN: 'telegram',
  MANAGEMENT_ZALO_POLLING_TOKEN: 'zalo',
  MANAGEMENT_API_TOKEN: 'api',
};
async function call(path, method, headers, service = {}) {
  let result;
  await handleManagementRequest(
    { url: path, method, headers },
    {},
    {
      env,
      service,
      readJson: async () => ({}),
      sendJson: (_res, status, body, headers) => {
        result = { status, body, headers };
      },
    }
  );
  return result;
}
test('each runtime credential is restricted to its own service', async () => {
  let calls = 0;
  const service = {
    runtime: async id => {
      calls++;
      return { env: { TOKEN: 'secret' }, id };
    },
  };
  assert.equal(
    (
      await call(
        '/api/management/runtime/telegram',
        'GET',
        { 'x-management-auth': 'zalo' },
        service
      )
    ).status,
    401
  );
  assert.equal(
    (
      await call(
        '/api/management/runtime/telegram',
        'GET',
        { 'x-management-admin-auth': 'admin' },
        service
      )
    ).status,
    401
  );
  assert.equal(
    (
      await call(
        '/api/management/save',
        'POST',
        { 'x-management-auth': 'telegram' },
        service
      )
    ).status,
    403
  );
  assert.equal(calls, 0);
  const result = await call(
    '/api/management/runtime/telegram',
    'GET',
    { 'x-management-auth': 'telegram' },
    service
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('runtime failures are safe and methods exact', async () => {
  const service = {
    runtime: async () => {
      throw Error('private-token-and-host');
    },
  };
  const result = await call(
    '/api/management/runtime/telegram',
    'GET',
    { 'x-management-auth': 'telegram' },
    service
  );
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes('private-token'), false);
  assert.equal(
    (
      await call(
        '/api/management/runtime/telegram/report',
        'GET',
        { 'x-management-auth': 'telegram' },
        service
      )
    ).status,
    405
  );
  assert.equal(
    (
      await call(
        '/api/management/alias/save',
        'POST',
        { 'x-management-admin-auth': 'admin' },
        service
      )
    ).status,
    404
  );
});
