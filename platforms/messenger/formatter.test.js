const test = require('node:test');
const assert = require('node:assert/strict');
const { formatMessengerMessage, splitMessengerText } = require('./formatter');

test('Messenger formatter preserves segments and appends action fallbacks', () => {
  assert.deepEqual(
    formatMessengerMessage({
      text: 'ignored',
      segments: [{ text: 'A' }, { text: '**B**', bold: true }],
      actions: [{ label: 'Vote', command: '/vote +1' }],
    }),
    { text: 'A**B**\n\n1. Vote — /vote +1', options: {} }
  );
});

test('Messenger formatter splits at readable boundaries', () => {
  assert.deepEqual(splitMessengerText('one two three four', 10), [
    'one two ',
    'three four',
  ]);
  assert.deepEqual(splitMessengerText(''), []);
  assert.throws(() => splitMessengerText('x', 0), /positive integer/);
});
