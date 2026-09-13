const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { formatStartupError } = require('./management-index');

test('reports missing management encryption key with setup advice', () => {
  const output = formatStartupError(
    { code: 'MANAGEMENT_ENCRYPTION_KEY_REQUIRED', message: 'secret bait' },
    {}
  );

  assert.match(output, /Missing MANAGEMENT_ENCRYPTION_KEY/);
  assert.match(output, /root \.env file/);
  assert.match(output, /32 random bytes encoded as base64/);
  assert.match(output, /reuse the original key/);
  assert.doesNotMatch(output, /secret bait/);
});

test('reports an invalid management encryption key without exposing it', () => {
  const output = formatStartupError(
    { code: 'MANAGEMENT_ENCRYPTION_KEY_REQUIRED', message: 'secret bait' },
    { MANAGEMENT_ENCRYPTION_KEY: 'secret bait' }
  );

  assert.match(output, /Invalid MANAGEMENT_ENCRYPTION_KEY/);
  assert.doesNotMatch(output, /secret bait/);
});

test('reports port conflicts with actionable advice', () => {
  const output = formatStartupError({
    code: 'EADDRINUSE',
    message: 'token bait',
  });

  assert.match(output, /port is already in use/);
  assert.match(output, /MANAGEMENT_PORT/);
  assert.doesNotMatch(output, /token bait/);
});

test('keeps unknown startup errors generic', () => {
  const output = formatStartupError({
    code: 'LEAK_ME',
    message: 'password=secret',
  });

  assert.equal(
    output,
    'Admin panel backend failed to start. Check the configured admin panel setup.'
  );
  assert.doesNotMatch(output, /LEAK_ME|password=secret/);
});

test('does not expose bait in known error output', () => {
  const output = formatStartupError({
    code: 'MANAGEMENT_DATABASE_UNAVAILABLE',
    message: 'DATABASE_URL=secret',
  });

  assert.match(output, /database is unavailable/);
  assert.doesNotMatch(output, /DATABASE_URL=secret/);
});

test('management entrypoint explains a missing key and exits without starting a server', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'management-startup-'));
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, 'management-index.js')],
      {
        cwd,
        env: {},
        encoding: 'utf8',
        timeout: 5000,
      }
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing MANAGEMENT_ENCRYPTION_KEY/);
    assert.doesNotMatch(result.stdout, /Admin panel backend ready/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
