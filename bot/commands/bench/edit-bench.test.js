const test = require('node:test');
const assert = require('node:assert/strict');

const { toEntry } = require('../../utils/team-member');

process.env.BOT_OWNER_ID = '123';

function loadEditBenchWithMockedBot(mockBot, registeredCallbacks) {
  const commandPath = require.resolve('./edit-bench');
  const telegramClientPath = require.resolve('../../telegram-client');
  const chatPath = require.resolve('../../utils/chat');
  const callbackQueryPath = require.resolve('../common/callback-query');

  delete require.cache[commandPath];
  delete require.cache[telegramClientPath];
  delete require.cache[chatPath];
  delete require.cache[callbackQueryPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  require.cache[callbackQueryPath] = {
    id: callbackQueryPath,
    filename: callbackQueryPath,
    loaded: true,
    exports: {
      registerCallbackQueryHandler(handler) {
        registeredCallbacks.push(handler);
      },
    },
  };

  return require('./edit-bench');
}

function createMockBot() {
  const handlers = [];
  const eventHandlers = [];
  const sentMessages = [];

  return {
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      on(event, handler) {
        eventHandlers.push({ event, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { ok: true };
      },
    },
    handlers,
    eventHandlers,
    sentMessages,
  };
}

test('/editbench shows inline player buttons', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const registeredCallbacks = [];
  const editBenchCommand = loadEditBenchWithMockedBot(bot, registeredCallbacks);
  const members = new Map([
    [1, toEntry('Nghia', 1)],
    [2, toEntry('Minh', 2)],
  ]);

  editBenchCommand({ members });

  const command = '/editbench';
  const handler = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(handler);
  await handler.handler(
    { text: command, chat: { id: -100 }, from: { id: 123 } },
    command.match(handler.pattern)
  );

  assert.equal(sentMessages[0].message, '📋 Chọn member cần đổi tên:');
  assert.deepEqual(sentMessages[0].options.reply_markup.inline_keyboard, [
    [{ text: '1. Nghia', callback_data: 'editbench:select:0' }],
    [{ text: '2. Minh', callback_data: 'editbench:select:1' }],
  ]);
});
