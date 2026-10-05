const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = fs
  .readFileSync(path.join(__dirname, '.vercelignore'), 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim());

test('Vercel leaves shared source available for automatic file tracing', () => {
  assert.equal(
    rules.includes('/*'),
    false,
    'A root allowlist would hide future local dependencies'
  );
  for (const rule of [
    '/bot/*',
    '/config/*',
    '/core/*',
    '/platforms/*',
    '/runtime/*',
    '/shared/*',
  ]) {
    assert.equal(
      rules.includes(rule),
      false,
      `${rule} must not hide shared source files`
    );
  }

  for (const path of ['.env*', 'node_modules/', 'api/data/bot/*', 'docs/']) {
    assert.ok(
      rules.includes(path),
      `Missing private or unused ignore rule: ${path}`
    );
  }

  const apiIgnoreIndex = rules.indexOf('/api/*');
  for (const entry of ['zalo-webhook.mjs', 'messenger-webhook.mjs']) {
    const allowIndex = rules.indexOf(`!/api/${entry}`);
    assert.ok(
      allowIndex > apiIgnoreIndex,
      `Webhook entry must follow /api/*: ${entry}`
    );
  }

  const managementIgnoreIndex = rules.indexOf('/api/management/*');
  assert.ok(
    rules.indexOf('!/api/management/catalog.js') > managementIgnoreIndex,
    'Management catalog must follow its ignore rule'
  );
  assert.ok(
    rules.includes('!/api/management/catalog.js'),
    'Management catalog must stay available to the webhook'
  );
});
