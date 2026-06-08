const test = require('node:test');
const assert = require('node:assert/strict');

const { toEntry } = require('../../utils/team-member');

process.env.BOT_OWNER_ID = '123';

function loadAddToTeamWithMockedBot(mockBot, registeredCallbacks) {
  const commandPath = require.resolve('./add-to-team');
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

  return require('./add-to-team');
}

function createMockBot() {
  const handlers = [];
  const sentMessages = [];

  return {
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { ok: true };
      },
    },
    handlers,
    sentMessages,
  };
}

test('/addtoteam team prompt shows paginated inline player buttons', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const registeredCallbacks = [];
  const addToTeamCommand = loadAddToTeamWithMockedBot(bot, registeredCallbacks);
  const members = new Map([
    [1, toEntry('Nghia', 1)],
    [2, toEntry('Minh', 2)],
  ]);

  addToTeamCommand({
    members,
    teamA: new Map(),
    teamB: new Map(),
    team3A: new Map(),
    team3B: new Map(),
    team3C: new Map(),
  });

  const command = '/addtoteam HOME';
  const handler = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(handler);
  await handler.handler(
    { text: command, chat: { id: -100 }, from: { id: 123 } },
    command.match(handler.pattern)
  );

  assert.equal(sentMessages[0].message, '📋 Chọn member để thêm vào Home:');
  assert.deepEqual(sentMessages[0].options.reply_markup.inline_keyboard, [
    [{ text: '1. Nghia', callback_data: 'addteam:add:2:HOME:0' }],
    [{ text: '2. Minh', callback_data: 'addteam:add:2:HOME:1' }],
  ]);
});

test('/addtoteam without args shows instruction', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const registeredCallbacks = [];
  const addToTeamCommand = loadAddToTeamWithMockedBot(bot, registeredCallbacks);

  addToTeamCommand({
    members: new Map(),
    teamA: new Map(),
    teamB: new Map(),
    team3A: new Map(),
    team3B: new Map(),
    team3C: new Map(),
  });

  const command = '/addtoteam';
  const handler = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(handler);
  await handler.handler(
    { text: command, chat: { id: -100 }, from: { id: 123 } },
    command.match(handler.pattern)
  );

  assert.match(sentMessages[0].message, /Cách sử dụng \/addtoteam/);
});
