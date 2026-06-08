const test = require('node:test');
const assert = require('node:assert/strict');

const { toEntry } = require('../../utils/team-member');

process.env.BOT_OWNER_ID = '123';

function loadClearBenchWithMockedBot(mockBot, registeredCallbacks) {
  const commandPath = require.resolve('./clear-bench');
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

  return require('./clear-bench');
}

function createMockBot() {
  const handlers = [];
  const sentMessages = [];
  const answeredCallbacks = [];
  const editedReplyMarkups = [];

  return {
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { message_id: sentMessages.length };
      },
      async answerCallbackQuery(id, options) {
        answeredCallbacks.push({ id, options });
        return { ok: true };
      },
      async editMessageReplyMarkup(replyMarkup, options) {
        editedReplyMarkups.push({ replyMarkup, options });
        return { ok: true };
      },
    },
    handlers,
    sentMessages,
    answeredCallbacks,
    editedReplyMarkups,
  };
}

test('/clearbench shows inline buttons for each bench member', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const registeredCallbacks = [];
  const clearBenchCommand = loadClearBenchWithMockedBot(bot, registeredCallbacks);
  const members = new Map([
    [1, toEntry('Nghia', 1)],
    [2, toEntry('Minh', 2)],
  ]);

  clearBenchCommand({ members });

  const listHandler = handlers.find(({ pattern }) => pattern.test('/clearbench'));
  assert.ok(listHandler);

  await listHandler.handler({
    text: '/clearbench',
    chat: { id: -100 },
    from: { id: 123 },
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, '📋 Chọn member cần xóa khỏi bench:');
  assert.doesNotMatch(sentMessages[0].message, /Nghia|Minh/);
  assert.deepEqual(sentMessages[0].options.reply_markup.inline_keyboard, [
    [{ text: '1. Nghia', callback_data: 'clearbench:remove:0' }],
    [{ text: '2. Minh', callback_data: 'clearbench:remove:1' }],
  ]);
});

test('/clearbench paginates inline buttons at 10 players per page', async () => {
  const { bot, handlers, sentMessages, editedReplyMarkups } = createMockBot();
  const registeredCallbacks = [];
  const clearBenchCommand = loadClearBenchWithMockedBot(bot, registeredCallbacks);
  const members = new Map(
    Array.from({ length: 12 }, (_, index) => [
      index + 1,
      toEntry(`Player ${index + 1}`, index + 1),
    ])
  );

  clearBenchCommand({ members });

  const listHandler = handlers.find(({ pattern }) => pattern.test('/clearbench'));
  assert.ok(listHandler);

  await listHandler.handler({
    text: '/clearbench',
    chat: { id: -100 },
    from: { id: 123 },
  });

  const firstPageKeyboard = sentMessages[0].options.reply_markup.inline_keyboard;
  assert.equal(firstPageKeyboard.slice(0, -1).length, 10);
  assert.deepEqual(firstPageKeyboard.at(-1), [
    { text: '1/2', callback_data: 'clearbench:page:0' },
    { text: 'Tiếp ➡️', callback_data: 'clearbench:page:1' },
  ]);

  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  try {
    const handled = await registeredCallbacks[0]({
      id: 'callback-page-1',
      data: 'clearbench:page:1',
      from: { id: 123 },
      message: { chat: { id: -100 }, message_id: 456 },
    });

    assert.equal(handled, true);
    assert.equal(editedReplyMarkups.length, 1);
    assert.deepEqual(editedReplyMarkups[0], {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '11. Player 11', callback_data: 'clearbench:remove:10' }],
          [{ text: '12. Player 12', callback_data: 'clearbench:remove:11' }],
          [
            { text: '⬅️ Trước', callback_data: 'clearbench:page:0' },
            { text: '2/2', callback_data: 'clearbench:page:1' },
          ],
        ],
      },
      options: {
        chat_id: -100,
        message_id: 456,
      },
    });
  } finally {
    if (originalOwnerId == null) {
      delete process.env.BOT_OWNER_ID;
    } else {
      process.env.BOT_OWNER_ID = originalOwnerId;
    }
  }
});

test('clearbench inline button removes selected bench member', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  try {
    const { bot, sentMessages, answeredCallbacks } = createMockBot();
    const registeredCallbacks = [];
    const clearBenchCommand = loadClearBenchWithMockedBot(
      bot,
      registeredCallbacks
    );
    const members = new Map([
      [1, toEntry('Nghia', 1)],
      [2, toEntry('Minh', 2)],
    ]);

    clearBenchCommand({ members });

    assert.equal(registeredCallbacks.length, 1);
    const handled = await registeredCallbacks[0]({
      id: 'callback-1',
      data: 'clearbench:remove:1',
      from: { id: 123 },
      message: { chat: { id: -100 }, message_id: 456 },
    });

    assert.equal(handled, true);
    assert.deepEqual(Array.from(members.values()).map(member => member.name), [
      'Nghia',
    ]);
    assert.deepEqual(answeredCallbacks, [
      {
        id: 'callback-1',
        options: {
          text: '✅ Đã xóa Minh khỏi bench.',
          show_alert: false,
        },
      },
    ]);
    assert.match(sentMessages[0].message, /Đã xóa Minh khỏi bench/);
  } finally {
    if (originalOwnerId == null) {
      delete process.env.BOT_OWNER_ID;
    } else {
      process.env.BOT_OWNER_ID = originalOwnerId;
    }
  }
});
