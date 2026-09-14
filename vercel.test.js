const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = fs
  .readFileSync(path.join(__dirname, '.vercelignore'), 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim());

test('Vercel allowlist includes all Zalo webhook local dependencies', () => {
  const requiredRules = [
    ['/api/*', '!/api/management/catalog.js'],
    ['/config/*', '!/config/load-env.js'],
    ['/runtime/*', '!/runtime/bot-controls.js'],
    ['/runtime/*', '!/runtime/managed-bootstrap.js'],
    ['/runtime/*', '!/runtime/managed-process.js'],
    ['/runtime/*', '!/runtime/managed-runtime-client.js'],
  ];

  for (const [ignoreRule, allowRule] of requiredRules) {
    assert.ok(rules.includes(ignoreRule), `Missing ignore rule: ${ignoreRule}`);
    assert.ok(rules.includes(allowRule), `Missing allow rule: ${allowRule}`);
    assert.ok(
      rules.indexOf(allowRule) > rules.indexOf(ignoreRule),
      `${allowRule} must follow ${ignoreRule}`
    );
  }
});
