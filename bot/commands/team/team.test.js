const test = require('node:test');
const assert = require('node:assert/strict');

function loadTeamWithMockedBot(mockBot) {
  const commandPath = require.resolve('./team');
  const chatPath = require.resolve('../../utils/chat');
  const telegramClientPath = require.resolve('../../telegram-client');

  delete require.cache[commandPath];
  delete require.cache[chatPath];
  delete require.cache[telegramClientPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require('./team');
}

function createMockBot() {
  const handlers = [];
  const sentMessages = [];

  return {
    handlers,
    sentMessages,
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { ok: true };
      },
    },
  };
}

async function invokeCommand(handlers, command) {
  const handler = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(handler, `Missing handler for ${command}`);

  return handler.handler(
    {
      from: { id: 123 },
      chat: { id: 456 },
      text: command,
    },
    command.match(handler.pattern)
  );
}

test('/team refreshes names from shared API storage before replying', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const teamCommand = loadTeamWithMockedBot(bot);
  const teamA = new Map([[1, { name: 'Old home name' }]]);
  const teamB = new Map([[2, { name: 'Old away name' }]]);
  let refreshCount = 0;

  teamCommand({
    teamA,
    teamB,
    team3A: new Map(),
    team3B: new Map(),
    team3C: new Map(),
    refreshFromSource: async () => {
      refreshCount += 1;
      teamA.set(1, { name: 'Admin home name' });
      teamB.set(2, { name: 'Admin away name' });
    },
  });

  await invokeCommand(handlers, '/team');

  assert.equal(refreshCount, 1);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /Admin home name/);
  assert.match(sentMessages[0].message, /Admin away name/);
  assert.doesNotMatch(sentMessages[0].message, /Old home name/);
});
