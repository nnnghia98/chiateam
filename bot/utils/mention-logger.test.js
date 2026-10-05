const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerMentionLogger } = require('./mention-logger');

test('message listener logs only mentions of its own bot, including captions', t => {
  let now = 10000;
  t.mock.method(Date, 'now', () => now);
  const output = [];
  t.mock.method(console, 'log', value => output.push(value));
  const bot = new EventEmitter();
  const replies = [];
  bot.sendMessage = async (...args) => replies.push(args);
  registerMentionLogger(bot, { id: 42, username: 'chiateam_dev_bot' });
  const base = {
    from: { id: 7, first_name: 'Nghia', last_name: 'Nguyen' },
    chat: { id: -10 },
    message_id: 5,
    message_thread_id: 9,
  };
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
    now += 5000;
    const before = output.length;
    const repliesBefore = replies.length;
    bot.emit('message', {
      ...base,
      text,
      entities: type ? [{ type, offset, length: text.length - offset }] : [],
    });
    assert.equal(output.length - before, Number(expected), text);
    assert.equal(replies.length - repliesBefore, Number(expected), text);
  }
  now += 5000;
  bot.emit('message', {
    ...base,
    caption: 'Hi @chiateam_dev_bot',
    caption_entities: [{ type: 'mention', offset: 3, length: 17 }],
  });
  assert.equal(output.length, 4);
  assert.equal(replies.length, 4);
  assert.deepEqual(replies[0], [
    -10,
    'Hi Nghia Nguyen',
    {
      reply_parameters: { message_id: 5, allow_sending_without_reply: true },
      message_thread_id: 9,
    },
  ]);
  assert.equal(replies.at(-1)[1], 'Hi Nghia Nguyen');
  assert.match(output[0], /\[telegram\.mention\]/);
  assert.match(output[0], /user_id\s+: 7/);
  assert.match(output[0], /chat_id\s+: -10/);
  assert.match(output[0], /"Hi @chiateam_dev_bot"/);
});

test('mention logging has a five-second cooldown per sender and chat', t => {
  const output = [];
  let now = 10000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(console, 'log', value => output.push(value));
  const bot = new EventEmitter();
  const replies = [];
  bot.sendMessage = async (...args) => replies.push(args);
  registerMentionLogger(bot, { id: 43, username: 'chiateam_dev_bot' });
  const mention = {
    from: { id: 7 },
    chat: { id: -10 },
    text: '@chiateam_dev_bot',
    entities: [{ type: 'mention', offset: 0, length: 17 }],
  };

  bot.emit('message', mention);
  assert.equal(output.length, 1);
  assert.equal(replies.length, 1);
  now += 4999;
  bot.emit('message', mention);
  assert.equal(output.length, 1, 'repeated mention is ignored');
  assert.equal(replies.length, 1, 'repeated mention gets no reply');
  bot.emit('message', { ...mention, from: { id: 8 } });
  bot.emit('message', { ...mention, chat: { id: -11 } });
  assert.equal(output.length, 3, 'other senders and chats are independent');
  assert.equal(replies.length, 3);
  now += 1;
  bot.emit('message', mention);
  assert.equal(output.length, 4, 'spam does not extend the cooldown');
  assert.equal(replies.length, 4);

  const anonymous = { ...mention, from: undefined, sender_chat: { id: -99 } };
  bot.emit('message', anonymous);
  bot.emit('message', anonymous);
  assert.equal(output.length, 5, 'chat senders also have a cooldown');
  assert.equal(replies.length, 5);
  assert.match(output.at(-1), /user_id\s+: -99/);
});
