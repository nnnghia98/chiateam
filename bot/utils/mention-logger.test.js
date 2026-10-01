const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerMentionLogger } = require('./mention-logger');

test('message listener logs only mentions of its own bot, including captions', t => {
  const output = [];
  t.mock.method(console, 'log', value => output.push(value));
  const bot = new EventEmitter();
  registerMentionLogger(bot, { id: 42, username: 'chiateam_dev_bot' });
  const base = { from: { id: 7 }, chat: { id: -10 }, message_id: 5 };
  const cases = [
    ['Hi @chiateam_dev_bot', 'mention', 3, true],
    ['😀 @CHIATEAM_DEV_BOT', 'mention', 3, true],
    ['/start@chiateam_dev_bot', 'bot_command', 0, true],
    ['Hi @other_bot', 'mention', 3, false],
    ['Hi @chiateam_dev_bot_extra', 'mention', 3, false],
    ['/start', 'bot_command', 0, false],
    ['Hi @chiateam_dev_bot', 'code', 3, false],
    ['Hi', null, 0, false],
  ];
  for (const [text, type, offset, expected] of cases) {
    const before = output.length;
    bot.emit('message', {
      ...base,
      text,
      entities: type ? [{ type, offset, length: text.length - offset }] : [],
    });
    assert.equal(output.length - before, Number(expected), text);
  }
  bot.emit('message', {
    ...base,
    caption: 'Hi @chiateam_dev_bot',
    caption_entities: [{ type: 'mention', offset: 3, length: 17 }],
  });
  assert.equal(output.length, 4);
  assert.match(output[0], /\[telegram\.mention\]/);
  assert.match(output[0], /user_id\s+: 7/);
  assert.match(output[0], /chat_id\s+: -10/);
  assert.match(output[0], /"Hi @chiateam_dev_bot"/);
});
