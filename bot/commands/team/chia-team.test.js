const test = require('node:test');
const assert = require('node:assert/strict');

function loadChiaTeamWithMockedBot(mockBot) {
  const commandPath = require.resolve('./chia-team');
  const chatPath = require.resolve('../../utils/chat');
  const permissionsPath = require.resolve('../../utils/permissions');
  const telegramClientPath = require.resolve('../../telegram-client');

  delete require.cache[commandPath];
  delete require.cache[chatPath];
  delete require.cache[permissionsPath];
  delete require.cache[telegramClientPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require('./chia-team');
}

test('/chiateam 3 can create three-team stack when two-team stack already exists', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const handlers = [];
  const sentMessages = [];
  const mockBot = {
    onText(pattern, handler) {
      handlers.push({ pattern, handler });
    },
    async sendMessage(chatId, message, options) {
      sentMessages.push({ chatId, message, options });
      return { ok: true };
    },
  };

  const chiateamCommand = loadChiaTeamWithMockedBot(mockBot);
  const members = new Map([
    [1, { name: 'A', userId: 1 }],
    [2, { name: 'B', userId: 2 }],
    [3, { name: 'C', userId: 3 }],
  ]);
  const teamA = new Map([[1, { name: 'A', userId: 1 }]]);
  const teamB = new Map([[2, { name: 'B', userId: 2 }]]);
  const team3A = new Map();
  const team3B = new Map();
  const team3C = new Map();

  chiateamCommand({ members, teamA, teamB, team3A, team3B, team3C });

  const threeTeamHandler = handlers.find(({ pattern }) =>
    pattern.test('/chiateam 3')
  ).handler;

  await threeTeamHandler({
    from: { id: 123 },
    chat: { id: 456 },
    text: '/chiateam 3',
  });

  assert.equal(teamA.size, 1);
  assert.equal(teamB.size, 1);
  assert.equal(team3A.size + team3B.size + team3C.size, 3);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /\*Chia 3 team\*/);

  process.env.BOT_OWNER_ID = originalOwnerId;
});
