const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MESSENGER_COMMAND_MANIFEST,
  MESSENGER_COMMAND_NAMES,
  createMessengerCommandDefinitions,
} = require('./create-messenger-command-definitions');

test('Messenger command definitions expose only the approved MVP commands', () => {
  assert.deepEqual(
    MESSENGER_COMMAND_MANIFEST.map(entry => entry.name),
    MESSENGER_COMMAND_NAMES
  );
  assert.deepEqual(
    createMessengerCommandDefinitions().map(definition => definition.name),
    MESSENGER_COMMAND_NAMES
  );
  assert.equal(
    MESSENGER_COMMAND_MANIFEST.every(entry => entry.permission === 'player'),
    true
  );
  assert.equal(
    MESSENGER_COMMAND_MANIFEST.some(entry => entry.aliases.length),
    false
  );
});
