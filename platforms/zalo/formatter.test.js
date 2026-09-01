const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRichTextResult,
  createTextResult,
} = require('../../core/contracts/command-result');
const { formatZaloMessage, splitZaloText } = require('./formatter');

test('Zalo formatter keeps plain messages plain', () => {
  const result = createTextResult('Bench ready.');

  assert.deepEqual(formatZaloMessage(result.messages[0]), {
    text: 'Bench ready.',
    options: {},
  });
});

test('Zalo formatter renders rich text and action command fallbacks', () => {
  const result = createRichTextResult(
    [{ text: 'Team', bold: true }, { text: '\nA_B' }],
    [
      {
        id: 'view_team',
        label: 'Home-Away',
        command: '/team',
      },
    ]
  );

  assert.deepEqual(formatZaloMessage(result.messages[0]), {
    text: '**Team**\nA\\_B\n\n1. Home\\-Away — /team',
    options: { parse_mode: 'markdown' },
  });
});

test('Zalo formatter splits messages at the platform limit', () => {
  assert.deepEqual(splitZaloText('12345\n67890', 6), ['12345\n', '67890']);
  assert.deepEqual(splitZaloText('abcdefgh', 3), ['abc', 'def', 'gh']);
  assert.deepEqual(splitZaloText('', 3), []);
});
