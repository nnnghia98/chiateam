const test = require('node:test');
const assert = require('node:assert/strict');

const { BENCH } = require('../../utils/messages');

function loadBenchWithMockedBot(mockBot) {
  const commandPath = require.resolve('./bench');
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

  return require('./bench');
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

async function invokeBench(handlers) {
  const command = '/bench';
  const registered = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(registered, 'Missing /bench handler');

  await registered.handler({
    from: { id: 123, first_name: 'Nghia' },
    chat: { id: 456 },
    text: command,
  });
}

test('/bench returns an empty result without requiring another command', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const benchCommand = loadBenchWithMockedBot(bot);
  const members = new Map();
  let refreshCount = 0;

  benchCommand({
    members,
    refreshFromSource: async () => {
      refreshCount += 1;
    },
  });

  await invokeBench(handlers);

  assert.equal(refreshCount, 1);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, BENCH.emptyBench);
  assert.equal(members.size, 0);
});

test('/bench returns the current roster without changing it', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const benchCommand = loadBenchWithMockedBot(bot);
  const members = new Map([
    [1, { name: 'Nghia', userId: 1 }],
    [2, { name: 'Minh (@minh)', userId: 2 }],
  ]);
  const originalEntries = Array.from(members.entries());

  benchCommand({ members, refreshFromSource: async () => {} });

  await invokeBench(handlers);

  assert.equal(sentMessages.length, 1);
  assert.equal(
    sentMessages[0].message,
    '👥 Danh sách hiện tại:\n1. Nghia\n2. Minh (@minh)\n\nTổng: 2 player(s)'
  );
  assert.deepEqual(Array.from(members.entries()), originalEntries);
});

test('/bench reports a refresh failure without showing stale state', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const benchCommand = loadBenchWithMockedBot(bot);
  const members = new Map([[1, { name: 'Stale player', userId: 1 }]]);

  benchCommand({
    members,
    refreshFromSource: async () => {
      throw new Error('API unavailable');
    },
  });

  await invokeBench(handlers);

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, BENCH.refreshError);
  assert.doesNotMatch(sentMessages[0].message, /Stale player/);
  assert.equal(members.size, 1);
});
