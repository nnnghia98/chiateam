const test = require('node:test');
const assert = require('node:assert/strict');

const { createTextResult } = require('../../core/contracts/command-result');
const { createTelegramAdapter } = require('./adapter');
const {
  createReplyKeyboard,
  getReplyKeyboardCommand,
} = require('./reply-keyboard');

class MockBot {
  constructor() {
    this.sent = [];
    this.failThreadOnce = false;
  }

  on() {}

  async sendMessage(chatId, text, options) {
    this.sent.push({ chatId, text, options });
    if (this.failThreadOnce && options.message_thread_id != null) {
      this.failThreadOnce = false;
      throw new Error('message thread not found');
    }
  }
}

function event(text) {
  return {
    text,
    from: { id: 7, first_name: 'Test' },
    chat: { id: -20 },
    message_thread_id: 4,
  };
}

test('reply keyboard maps exact labels and keeps Telegram options', () => {
  assert.equal(getReplyKeyboardCommand('  ➕ Tham gia  '), '/addme');
  assert.equal(getReplyKeyboardCommand('📋 Bench'), '/bench');
  assert.equal(getReplyKeyboardCommand('hello'), null);
  assert.equal(getReplyKeyboardCommand('constructor'), null);
  assert.equal(getReplyKeyboardCommand('toString'), null);
  assert.equal(getReplyKeyboardCommand('/bench 2'), null);
  assert.deepEqual(createReplyKeyboard(), {
    keyboard: [
      [{ text: '➕ Tham gia' }, { text: '📋 Bench' }],
      [{ text: '⚽ Team' }, { text: '🗳️ Kết quả vote' }],
      [{ text: '👤 Thông tin của tôi' }, { text: '📅 Lịch sử trận' }],
      [{ text: '📖 Hướng dẫn' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: false,
  });
});

test('keyboard labels route as commands and slash arguments stay intact', async () => {
  const bot = new MockBot();
  const contexts = [];
  const adapter = createTelegramAdapter({
    bot,
    router: {
      async run(context) {
        contexts.push(context);
        return { handled: true, result: createTextResult('ok') };
      },
    },
  });

  assert.equal(adapter.toCommandContext(event('⚽ Team')).command, 'team');
  assert.deepEqual(adapter.toCommandContext(event('/team 2')).args, ['2']);
  await adapter.handleEvent(event('📋 Bench'));
  assert.equal(contexts[0].command, 'bench');
});

test('start attaches keyboard to source chat and topic, including keyboard route', async () => {
  const bot = new MockBot();
  const adapter = createTelegramAdapter({
    bot,
    channelConfig: { chatId: '-100', threads: { main: '88' } },
    router: {
      run: async () => ({
        handled: true,
        result: createTextResult('Help', [], { channel: 'main' }),
      }),
    },
  });

  await adapter.handleEvent(event('📖 Hướng dẫn'));
  assert.equal(bot.sent[0].chatId, '-20');
  assert.equal(bot.sent[0].options.message_thread_id, '4');
  assert.deepEqual(bot.sent[0].options.reply_markup, createReplyKeyboard());
});

test('start does not overwrite inline keyboards or pending input prompts', async () => {
  const bot = new MockBot();
  let call = 0;
  const adapter = createTelegramAdapter({
    bot,
    router: {
      run: async () => {
        call += 1;
        return call === 1
          ? {
              handled: true,
              result: createTextResult('Choose', [{ id: 'x', label: 'X' }]),
            }
          : {
              handled: true,
              result: createTextResult('Enter', [], {
                input: { command: 'bench' },
              }),
            };
      },
    },
  });

  await adapter.handleEvent(event('/start'));
  await adapter.handleEvent(event('/start'));
  assert.equal('inline_keyboard' in bot.sent[0].options.reply_markup, true);
  assert.equal(bot.sent[1].options.reply_markup, undefined);
});

test('keyboard output keeps markup when topic delivery retries without thread', async () => {
  const bot = new MockBot();
  bot.failThreadOnce = true;
  const adapter = createTelegramAdapter({
    bot,
    router: {
      run: async () => ({ handled: true, result: createTextResult('Help') }),
    },
  });

  await adapter.handleEvent(event('/start'));
  assert.equal(bot.sent.length, 2);
  assert.equal(bot.sent[1].options.message_thread_id, undefined);
  assert.deepEqual(bot.sent[1].options.reply_markup, createReplyKeyboard());
});

test('gate blocks keyboard labels before routing', async () => {
  const bot = new MockBot();
  let routed = false;
  const adapter = createTelegramAdapter({
    bot,
    commandGate: {
      check: async () => ({ available: true, commandsEnabled: false }),
    },
    router: {
      run: async () => {
        routed = true;
        return { handled: true, result: createTextResult('ok') };
      },
    },
  });

  await adapter.handleEvent(event('📋 Bench'));
  assert.equal(routed, false);
  assert.match(bot.sent[0].text, /paused/i);
});

test('keyboard label cancels pending input and routes its own command', async () => {
  const bot = new MockBot();
  const commands = [];
  const adapter = createTelegramAdapter({
    bot,
    router: {
      async run(context) {
        commands.push(context.command);
        return context.command === 'editbench'
          ? {
              handled: true,
              result: createTextResult('Enter', [], {
                input: { command: 'editbench' },
              }),
            }
          : { handled: true, result: createTextResult('Bench') };
      },
    },
  });

  await adapter.handleEvent(event('/editbench'));
  await adapter.handleEvent(event('📋 Bench'));
  await adapter.handleEvent(event('late reply'));
  assert.deepEqual(commands, ['editbench', 'bench']);
});
