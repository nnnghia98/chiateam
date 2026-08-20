const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMAND_MANIFEST,
  getCommandManifestEntry,
  listSupportedCommandNames,
} = require('./command-manifest');

test('command manifest has one unique supported command list', () => {
  const names = listSupportedCommandNames();

  assert.equal(COMMAND_MANIFEST.length, 33);
  assert.equal(names.length, 34);
  assert.equal(new Set(names).size, names.length);
  assert.equal(getCommandManifestEntry('/mf').name, 'manifests');
  assert.equal(getCommandManifestEntry('/missing'), null);
});
