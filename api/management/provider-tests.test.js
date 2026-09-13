const test = require('node:test');
const assert = require('node:assert/strict');
const { testConnections } = require('./provider-tests');

const response = body => ({ ok: true, status: 200, json: async () => body });

test('Supabase check uses storage endpoint and candidate service key headers', async () => {
  let call;
  const result = await testConnections('supabase', {
    env: {
      SUPABASE_URL: 'https://db.example',
      MANAGEMENT_ALLOWED_ORIGINS: 'https://db.example',
    },
    changes: {
      secrets: { SUPABASE_SERVICE_ROLE_KEY: { value: 'candidate-key' } },
    },
    fetchImpl: async (url, options) => {
      call = { url, options };
      return response({});
    },
  });
  assert.equal(result.ok, true);
  assert.equal(call.url, 'https://db.example/storage/v1/bucket');
  assert.equal(call.options.headers.Authorization, 'Bearer candidate-key');
  assert.equal(call.options.headers.apikey, 'candidate-key');
  assert.equal(call.options.redirect, 'error');
});

test('Gemini check uses the fixed models endpoint and key header', async () => {
  let call;
  const result = await testConnections('gemini', {
    changes: { secrets: { GEMINI_API_KEY: { value: 'candidate-key' } } },
    fetchImpl: async (url, options) => {
      call = { url, options };
      return response({ models: [] });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(
    call.url,
    'https://generativelanguage.googleapis.com/v1beta/models'
  );
  assert.equal(call.options.headers['x-goog-api-key'], 'candidate-key');
});

test('API check posts to the signed bot controls endpoint', async () => {
  let call;
  const result = await testConnections('api', {
    env: {
      ADMIN_API_URL: 'https://api.example',
      MANAGEMENT_ALLOWED_ORIGINS: 'https://api.example',
      INTERNAL_API_AUTH_TOKEN: 'old',
    },
    changes: { secrets: { INTERNAL_API_AUTH_TOKEN: { value: 'candidate' } } },
    fetchImpl: async (url, options) => {
      call = { url, options };
      return response({ ok: true });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(call.url, 'https://api.example/api/bot-controls');
  assert.equal(call.options.headers['x-internal-api-auth'], 'candidate');
  assert.equal(call.options.headers['x-admin-role'], 'admin');
  assert.equal(call.options.method, 'GET');
});

test('provider errors never return raw network messages', async () => {
  const result = await testConnections('gemini', {
    changes: { secrets: { GEMINI_API_KEY: { value: 'candidate' } } },
    fetchImpl: async () => {
      throw new Error('secret-key-in-url');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'NETWORK_ERROR');
  assert.doesNotMatch(JSON.stringify(result), /secret-key-in-url/);
});

test('secret candidate actions are explicit and redirects are rejected', async () => {
  let callCount = 0;
  const removed = await testConnections('gemini', {
    env: { GEMINI_API_KEY: 'old' },
    changes: { secrets: { GEMINI_API_KEY: { action: 'remove' } } },
    fetchImpl: async () => {
      callCount += 1;
      return response({ models: [] });
    },
  });
  assert.equal(removed.errorCode, 'MISSING_CREDENTIAL');
  assert.equal(callCount, 0);
  const redirected = await testConnections('gemini', {
    changes: {
      secrets: { GEMINI_API_KEY: { action: 'replace', value: 'candidate' } },
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      redirected: true,
      json: async () => ({ models: [] }),
    }),
  });
  assert.equal(redirected.errorCode, 'PROVIDER_CHECK_FAILED');
});

test('API base ending in /api is tested without a duplicated prefix', async () => {
  let called;
  const result = await testConnections('api', {
    env: {
      ADMIN_API_URL: 'https://api.example/api',
      MANAGEMENT_ALLOWED_ORIGINS: 'https://api.example',
      INTERNAL_API_AUTH_TOKEN: 'test',
    },
    fetchImpl: async url => {
      called = url;
      return response({ ok: true });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(called, 'https://api.example/api/bot-controls');
});
test('production managed database connections use certificate-checked TLS', () => {
  const { managedConnectionOptions } = require('../db/managed-connection');
  assert.deepEqual(
    managedConnectionOptions('postgres://db.test/app', {
      NODE_ENV: 'production',
    }).ssl,
    { rejectUnauthorized: true }
  );
});
