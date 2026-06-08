const test = require('node:test');
const assert = require('node:assert/strict');

function loadChatWithMockedBot(mockBot) {
  const chatPath = require.resolve('./chat');
  const telegramClientPath = require.resolve('../telegram-client');

  delete require.cache[chatPath];
  delete require.cache[telegramClientPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require('./chat');
}

test('sendMessage retries without thread_id using a mutable copy of options', async () => {
  const originalChatId = process.env.CHAT_ID;
  const originalMainThreadId = process.env.MAIN_THREAD_ID;

  process.env.CHAT_ID = '-1002894567617';
  process.env.MAIN_THREAD_ID = '1';

  const calls = [];
  const mockBot = {
    async sendMessage(chatId, message, options) {
      calls.push({ chatId, message, options });

      // Mimic node-telegram-bot-api mutating the options object internally.
      if (!Object.isExtensible(options)) {
        throw new TypeError('Cannot add property chat_id, object is not extensible');
      }

      options.chat_id = chatId;

      if (calls.length === 1) {
        throw new Error('ETELEGRAM: 400 Bad Request: message thread not found');
      }

      return { ok: true };
    },
  };

  const { sendMessage } = loadChatWithMockedBot(mockBot);
  const options = Object.freeze({ parse_mode: 'Markdown' });

  await sendMessage({
    msg: { chat: { id: -100123 } },
    type: 'MAIN',
    message: 'hello',
    options,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.message_thread_id, '1');
  assert.deepEqual(calls[1].options, {
    parse_mode: 'Markdown',
    chat_id: '-1002894567617',
  });
  assert.notEqual(calls[1].options, options);

  process.env.CHAT_ID = originalChatId;
  process.env.MAIN_THREAD_ID = originalMainThreadId;
});

test('sendMessage can ignore configured chat id for source chat replies', async () => {
  const originalChatId = process.env.CHAT_ID;
  const originalDefaultThreadId = process.env.DEFAULT_THREAD_ID;

  process.env.CHAT_ID = '-100configured';
  process.env.DEFAULT_THREAD_ID = '999';

  const calls = [];
  const mockBot = {
    async sendMessage(chatId, message, options) {
      calls.push({ chatId, message, options });
      return { ok: true };
    },
  };

  const { sendMessage } = loadChatWithMockedBot(mockBot);

  await sendMessage({
    msg: { chat: { id: -100123 }, message_thread_id: 12 },
    type: 'DEFAULT',
    message: 'choose',
    options: {
      reply_markup: { inline_keyboard: [] },
      useSourceChat: true,
    },
  });

  assert.deepEqual(calls, [
    {
      chatId: -100123,
      message: 'choose',
      options: {
        reply_markup: { inline_keyboard: [] },
        message_thread_id: 12,
      },
    },
  ]);

  process.env.CHAT_ID = originalChatId;
  process.env.DEFAULT_THREAD_ID = originalDefaultThreadId;
});
