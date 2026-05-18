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

function findHandler(handlers, command) {
  return handlers.find(({ pattern }) => pattern.test(command)).handler;
}

function memberMap(count) {
  return new Map(
    Array.from({ length: count }, (_, idx) => [
      idx + 1,
      { name: `Player ${idx + 1}`, userId: idx + 1 },
    ])
  );
}

function maxSizeDiff(teamMaps) {
  const sizes = teamMaps.map(team => team.size);
  return Math.max(...sizes) - Math.min(...sizes);
}

async function withMockedRandom(values, callback) {
  const originalRandom = Math.random;
  const queue = [...values];
  Math.random = () => queue.shift() ?? 0;

  try {
    await callback();
  } finally {
    Math.random = originalRandom;
  }
}

test('/chiateam 3 can create three-team stack when two-team stack already exists', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const { bot, handlers, sentMessages } = createMockBot();

  const chiateamCommand = loadChiaTeamWithMockedBot(bot);
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

  const threeTeamHandler = findHandler(handlers, '/chiateam 3');

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

test('/chiateam keeps two-team split within one player', async () => {
  const { bot, handlers } = createMockBot();
  const chiateamCommand = loadChiaTeamWithMockedBot(bot);
  const members = memberMap(5);
  const teamA = new Map();
  const teamB = new Map();

  chiateamCommand({
    members,
    teamA,
    teamB,
    team3A: new Map(),
    team3B: new Map(),
    team3C: new Map(),
  });

  await findHandler(handlers, '/chiateam')({
    from: { id: 123 },
    chat: { id: 456 },
    text: '/chiateam',
  });

  assert.equal(teamA.size + teamB.size, 5);
  assert.ok(maxSizeDiff([teamA, teamB]) <= 1);
});

test('/chiateam 3 keeps three-team split within one player', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const { bot, handlers } = createMockBot();
  const chiateamCommand = loadChiaTeamWithMockedBot(bot);
  const members = memberMap(7);
  const team3A = new Map();
  const team3B = new Map();
  const team3C = new Map();

  chiateamCommand({
    members,
    teamA: new Map(),
    teamB: new Map(),
    team3A,
    team3B,
    team3C,
  });

  await findHandler(handlers, '/chiateam 3')({
    from: { id: 123 },
    chat: { id: 456 },
    text: '/chiateam 3',
  });

  assert.equal(team3A.size + team3B.size + team3C.size, 7);
  assert.ok(maxSizeDiff([team3A, team3B, team3C]) <= 1);

  process.env.BOT_OWNER_ID = originalOwnerId;
});

test('/chiateam adds players to the smaller team before larger teams', async () => {
  const { bot, handlers } = createMockBot();
  const chiateamCommand = loadChiaTeamWithMockedBot(bot);
  const members = memberMap(4);
  const teamA = new Map([
    [1, { name: 'Player 1', userId: 1 }],
    [2, { name: 'Player 2', userId: 2 }],
  ]);
  const teamB = new Map();

  chiateamCommand({
    members,
    teamA,
    teamB,
    team3A: new Map(),
    team3B: new Map(),
    team3C: new Map(),
  });

  await findHandler(handlers, '/chiateam')({
    from: { id: 123 },
    chat: { id: 456 },
    text: '/chiateam',
  });

  assert.equal(teamA.size, 2);
  assert.equal(teamB.size, 2);
});

test('/chiateam 3 randomly chooses among equally small teams', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const { bot, handlers } = createMockBot();
  const chiateamCommand = loadChiaTeamWithMockedBot(bot);
  const members = memberMap(4);
  const team3A = new Map([[1, { name: 'Player 1', userId: 1 }]]);
  const team3B = new Map([[2, { name: 'Player 2', userId: 2 }]]);
  const team3C = new Map([[3, { name: 'Player 3', userId: 3 }]]);

  chiateamCommand({
    members,
    teamA: new Map(),
    teamB: new Map(),
    team3A,
    team3B,
    team3C,
  });

  await withMockedRandom([0.99, 0], async () => {
    await findHandler(handlers, '/chiateam 3')({
      from: { id: 123 },
      chat: { id: 456 },
      text: '/chiateam 3',
    });
  });

  assert.equal(team3A.size, 1);
  assert.equal(team3B.size, 1);
  assert.equal(team3C.size, 2);

  process.env.BOT_OWNER_ID = originalOwnerId;
});
