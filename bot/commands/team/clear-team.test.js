const test = require('node:test');
const assert = require('node:assert/strict');

function loadClearTeamWithMockedBot(mockBot) {
  const commandPath = require.resolve('./clear-team');
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

  return require('./clear-team');
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
  return handlers.find(({ pattern }) => pattern.test(command));
}

function msg(text) {
  return {
    from: { id: 123 },
    chat: { id: 456 },
    text,
  };
}

async function runHandler(handlers, command) {
  const handler = findHandler(handlers, command);
  await handler.handler(msg(command), handler.pattern.exec(command));
}

test('/clearteam clears only the two-team stack', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const { bot, handlers } = createMockBot();
  const clearTeamCommand = loadClearTeamWithMockedBot(bot);
  const teamA = new Map([[1, 'A']]);
  const teamB = new Map([[2, 'B']]);
  const team3A = new Map([[3, 'C']]);
  const team3B = new Map([[4, 'D']]);
  const team3C = new Map([[5, 'E']]);

  clearTeamCommand({ teamA, teamB, team3A, team3B, team3C });

  await runHandler(handlers, '/clearteam');

  assert.equal(teamA.size, 0);
  assert.equal(teamB.size, 0);
  assert.equal(team3A.size, 1);
  assert.equal(team3B.size, 1);
  assert.equal(team3C.size, 1);

  process.env.BOT_OWNER_ID = originalOwnerId;
});

test('/clearteam 3 clears only the three-team stack', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const { bot, handlers } = createMockBot();
  const clearTeamCommand = loadClearTeamWithMockedBot(bot);
  const teamA = new Map([[1, 'A']]);
  const teamB = new Map([[2, 'B']]);
  const team3A = new Map([[3, 'C']]);
  const team3B = new Map([[4, 'D']]);
  const team3C = new Map([[5, 'E']]);

  clearTeamCommand({ teamA, teamB, team3A, team3B, team3C });

  await runHandler(handlers, '/clearteam 3');

  assert.equal(teamA.size, 1);
  assert.equal(teamB.size, 1);
  assert.equal(team3A.size, 0);
  assert.equal(team3B.size, 0);
  assert.equal(team3C.size, 0);

  process.env.BOT_OWNER_ID = originalOwnerId;
});

test('/clearteam EXTRA does not clear the three-team extra stack without mode 3', async () => {
  const originalOwnerId = process.env.BOT_OWNER_ID;
  process.env.BOT_OWNER_ID = '123';

  const { bot, handlers } = createMockBot();
  const clearTeamCommand = loadClearTeamWithMockedBot(bot);
  const team3C = new Map([[5, 'E']]);

  clearTeamCommand({
    teamA: new Map(),
    teamB: new Map(),
    team3A: new Map(),
    team3B: new Map(),
    team3C,
  });

  await runHandler(handlers, '/clearteam EXTRA');

  assert.equal(team3C.size, 1);

  process.env.BOT_OWNER_ID = originalOwnerId;
});
