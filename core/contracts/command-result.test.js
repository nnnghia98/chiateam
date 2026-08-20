const test = require('node:test');
const assert = require('node:assert/strict');

const { createRichTextResult, createTextResult } = require('./command-result');

test('text result provides a plain platform-neutral message', () => {
  const result = createTextResult('Bench is empty.');

  assert.equal(result.messages[0].text, 'Bench is empty.');
  assert.deepEqual(result.messages[0].segments, []);
});

test('rich text result keeps whitespace and creates a plain fallback', () => {
  const result = createRichTextResult([
    { text: '🎲 ' },
    { text: 'Current team', bold: true },
    { text: '\nHome_player' },
  ]);

  assert.equal(result.messages[0].text, '🎲 Current team\nHome_player');
  assert.deepEqual(result.messages[0].segments, [
    { text: '🎲 ', bold: false },
    { text: 'Current team', bold: true },
    { text: '\nHome_player', bold: false },
  ]);
  assert.equal(result.messages[0].channel, 'source');
});

test('command result keeps a logical delivery channel', () => {
  const result = createTextResult('Fee ready.', [], {
    channel: 'announcement',
  });

  assert.equal(result.messages[0].channel, 'announcement');
});

test('command result keeps a platform-neutral follow-up input', () => {
  const result = createTextResult('Enter a new name.', [], {
    input: { command: '/editbench', args: ['2'] },
  });

  assert.deepEqual(result.messages[0].input, {
    command: 'editbench',
    args: ['2'],
  });
});
