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
    text: 'Team\nA_B\n\n1. Home-Away — /team',
    options: {},
  });
});

test('Zalo formatter splits messages at the platform limit', () => {
  assert.deepEqual(splitZaloText('12345\n67890', 6), ['12345\n', '67890']);
  assert.deepEqual(splitZaloText('abcdefgh', 3), ['abc', 'def', 'gh']);
  assert.deepEqual(splitZaloText('', 3), []);
});

test('Zalo formatter keeps every chunk within a strict limit', () => {
  const chunks = splitZaloText('12345\n67890', 5);

  assert.deepEqual(chunks, ['12345', '\n6789', '0']);
  assert.ok(chunks.every(chunk => chunk.length <= 5));
});

test('Zalo formatter does not split emoji surrogate pairs', () => {
  const text = 'abc😀de😀fg';
  const chunks = splitZaloText(text, 4);

  assert.deepEqual(chunks, ['abc', '😀de', '😀fg']);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => chunk.length <= 4));
});

test('Zalo formatter rejects a one-unit limit before an emoji', () => {
  assert.throws(() => splitZaloText('😀a', 1), RangeError);
});

test('Zalo formatter keeps malformed surrogate data moving', () => {
  const text = 'a\udc00b';
  const chunks = splitZaloText(text, 1);

  assert.deepEqual(chunks, ['a', '\udc00', 'b']);
  assert.equal(chunks.join(''), text);
});
