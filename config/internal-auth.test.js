const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEV_FALLBACK_TOKEN,
  isPublicInternalApiToken,
  resolveInternalApiToken,
} = require('./internal-auth');

test('configured token is used in every environment', () => {
  for (const NODE_ENV of ['production', 'development', undefined]) {
    assert.equal(
      resolveInternalApiToken({
        NODE_ENV,
        INTERNAL_API_AUTH_TOKEN: ' real-secret ',
      }),
      'real-secret'
    );
  }
});

test('development works without a token and uses the public fallback', () => {
  for (const NODE_ENV of ['development', 'test', undefined]) {
    const env = { NODE_ENV };
    assert.equal(resolveInternalApiToken(env), DEV_FALLBACK_TOKEN);
    assert.equal(isPublicInternalApiToken(env), true);
  }
});

test('development keeps accepting the example placeholder', () => {
  const env = {
    NODE_ENV: 'development',
    INTERNAL_API_AUTH_TOKEN: 'change-this-shared-internal-token',
  };
  assert.equal(
    resolveInternalApiToken(env),
    'change-this-shared-internal-token'
  );
  assert.equal(isPublicInternalApiToken(env), true);
});

test('production rejects a missing or public placeholder token', () => {
  for (const INTERNAL_API_AUTH_TOKEN of [
    undefined,
    '',
    '   ',
    DEV_FALLBACK_TOKEN,
    'change-this-shared-internal-token',
  ]) {
    const env = { NODE_ENV: 'production', INTERNAL_API_AUTH_TOKEN };
    assert.equal(resolveInternalApiToken(env), null);
    assert.equal(isPublicInternalApiToken(env), false);
  }
});

test('a real token is not reported as public', () => {
  assert.equal(
    isPublicInternalApiToken({
      NODE_ENV: 'development',
      INTERNAL_API_AUTH_TOKEN: '123',
    }),
    false
  );
});
