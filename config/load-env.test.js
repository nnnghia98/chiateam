const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const dotenv = require('dotenv');

const { loadEnv } = require('./load-env');

test('loadEnv always loads the root .env file', () => {
  const originalConfig = dotenv.config;
  const originalEnvFile = process.env.ENV_FILE;
  const originalNodeEnv = process.env.NODE_ENV;
  const calls = [];

  dotenv.config = options => {
    calls.push(options);
    return { parsed: {} };
  };

  try {
    process.env.ENV_FILE = 'ignored.env';
    process.env.NODE_ENV = 'production';

    assert.equal(loadEnv(), '.env');
    assert.deepEqual(calls, [
      {
        path: path.resolve(process.cwd(), '.env'),
      },
    ]);
  } finally {
    dotenv.config = originalConfig;

    if (originalEnvFile === undefined) delete process.env.ENV_FILE;
    else process.env.ENV_FILE = originalEnvFile;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});
