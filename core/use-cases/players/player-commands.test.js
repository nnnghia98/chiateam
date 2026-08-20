const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createPlayerRepository } = require('../../ports/player-repository');
const { createStateRepository } = require('../../ports/state-repository');
const {
  createStatisticsRepository,
} = require('../../ports/statistics-repository');
const {
  EDIT_STATS_MESSAGES,
  createEditStatsCommand,
  parseEditStatsRequest,
} = require('./edit-stats-command');
const { ME_MESSAGES, createMeCommand } = require('./me-command');
const { PLAYER_MESSAGES, createPlayerCommand } = require('./player-command');
const { PLAYERS_MESSAGES, createPlayersCommand } = require('./players-command');
const {
  REGISTER_MESSAGES,
  createRegisterCommand,
  parseRegisterRequest,
} = require('./register-command');

function createContext(command, args = [], actorId = '123') {
  return {
    command,
    args,
    actor: {
      platform: 'telegram',
      externalId: actorId,
      displayName: 'Nghia Nguyen',
      username: 'nghia',
    },
    conversation: { externalId: '456', threadId: null },
  };
}

function createPlayers(overrides = {}) {
  return createPlayerRepository({
    async registerActor(actor, number) {
      return {
        ok: true,
        player: {
          user_id: Number(actor.externalId),
          name: actor.displayName,
          number,
        },
      };
    },
    async registerGuest(name, number) {
      return { ok: true, player: { name, number } };
    },
    async deleteByNumber() {
      return { ok: true };
    },
    async findByActor() {
      return null;
    },
    async findByNumber() {
      return null;
    },
    async list() {
      return [];
    },
    ...overrides,
  });
}

function createStatistics(overrides = {}) {
  return createStatisticsRepository({
    async findByNumber() {
      return null;
    },
    async findMany() {
      return [];
    },
    async replaceTotals() {},
    async incrementGoals() {},
    async incrementAssists() {},
    ...overrides,
  });
}

function createRouter(definitions, { isAdmin = true } = {}) {
  return createCommandRouter({
    registry: createCommandRegistry(definitions),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load() {
        throw new Error('player commands must not load bot state');
      },
      async save() {
        throw new Error('player commands must not save bot state');
      },
    }),
  });
}

test('shared /register parser uses the approved explicit syntax', () => {
  assert.deepEqual(parseRegisterRequest([]), { kind: 'help' });
  assert.deepEqual(parseRegisterRequest(['10']), {
    kind: 'self',
    number: 10,
  });
  assert.deepEqual(parseRegisterRequest(['add', 'Nguyen', 'Van', 'A', '11']), {
    kind: 'add',
    name: 'Nguyen Van A',
    number: 11,
  });
  assert.deepEqual(parseRegisterRequest(['delete', '12']), {
    kind: 'delete',
    number: 12,
  });
  assert.equal(parseRegisterRequest(['Nguyen', '10']), null);
  assert.equal(parseRegisterRequest(['delete', '0']), null);
});

test('independent /register supports self, admin add, and admin delete', async () => {
  const calls = [];
  const players = createPlayers({
    async registerActor(actor, number) {
      calls.push(['self', actor.externalId, number]);
      return { ok: true, player: { name: 'Nghia', number } };
    },
    async registerGuest(name, number) {
      calls.push(['add', name, number]);
      return { ok: true, player: { name, number } };
    },
    async deleteByNumber(number) {
      calls.push(['delete', number]);
      return { ok: true };
    },
  });
  const router = createRouter([
    createRegisterCommand({ playerRepository: players }),
  ]);

  const self = await router.run(createContext('register', ['10']));
  const add = await router.run(
    createContext('register', ['add', 'Minh', 'Tran', '11'])
  );
  const remove = await router.run(createContext('register', ['delete', '12']));

  assert.deepEqual(calls, [
    ['self', '123', 10],
    ['add', 'Minh Tran', 11],
    ['delete', 12],
  ]);
  assert.match(self.result.messages[0].text, /Đăng ký thành công/);
  assert.doesNotMatch(add.result.messages[0].text, /\{number\}/);
  assert.match(add.result.messages[0].text, /\/register 11/);
  assert.match(remove.result.messages[0].text, /Đã xóa/);
});

test('independent /register enforces admin actions and maps conflicts', async () => {
  const players = createPlayers({
    async registerActor() {
      return {
        ok: false,
        code: 'NUMBER_IN_USE',
        data: { player: { name: 'Minh', number: 10 } },
      };
    },
  });
  const allowed = createRouter([
    createRegisterCommand({ playerRepository: players }),
  ]);
  const denied = createRouter(
    [createRegisterCommand({ playerRepository: players })],
    { isAdmin: false }
  );

  const conflict = await allowed.run(createContext('register', ['10']));
  const deniedResult = await denied.run(
    createContext('register', ['add', 'Minh', '11'], '999')
  );
  const invalid = await allowed.run(createContext('register', ['bad']));

  assert.match(conflict.result.messages[0].text, /Minh/);
  assert.equal(
    deniedResult.result.messages[0].text,
    REGISTER_MESSAGES.permissionDenied
  );
  assert.equal(invalid.result.messages[0].text, REGISTER_MESSAGES.usage);
});

test('independent /me shows linked player statistics and unlinked state', async () => {
  const linked = createRouter([
    createMeCommand({
      playerRepository: createPlayers({
        async findByActor() {
          return { name: 'Nghia', number: 10 };
        },
      }),
      statisticsRepository: createStatistics({
        async findByNumber(number) {
          assert.equal(number, 10);
          return { goal: 4, assist: 2 };
        },
      }),
    }),
  ]);
  const unlinked = createRouter([
    createMeCommand({
      playerRepository: createPlayers(),
      statisticsRepository: createStatistics(),
    }),
  ]);

  const linkedResult = await linked.run(createContext('me'));
  const unlinkedResult = await unlinked.run(createContext('me'));

  assert.match(linkedResult.result.messages[0].text, /Số áo: 10/);
  assert.match(linkedResult.result.messages[0].text, /Bàn thắng: 4/);
  assert.match(unlinkedResult.result.messages[0].text, /chưa đăng ký/i);
});

test('independent /me validates input and reports repository errors', async () => {
  const router = createRouter([
    createMeCommand({
      playerRepository: createPlayers({
        async findByActor() {
          throw new Error('database unavailable');
        },
      }),
      statisticsRepository: createStatistics(),
    }),
  ]);

  const invalid = await router.run(createContext('me', ['extra']));
  const failure = await router.run(createContext('me'));

  assert.equal(invalid.result.messages[0].text, ME_MESSAGES.usage);
  assert.equal(failure.result.messages[0].text, ME_MESSAGES.error);
});

test('independent /players merges ranking and paginates results', async () => {
  const playerRows = Array.from({ length: 11 }, (_, index) => ({
    name: `Player ${index + 1}`,
    number: index + 1,
  }));
  const router = createRouter([
    createPlayersCommand({
      playerRepository: createPlayers({
        async list() {
          return playerRows;
        },
      }),
      statisticsRepository: createStatistics({
        async findMany(numbers) {
          assert.equal(numbers.length, 11);
          return [
            {
              player_number: 11,
              total_match: 10,
              total_win: 9,
              winrate: 0.9,
            },
            {
              player_number: 1,
              total_match: 10,
              total_win: 5,
              winrate: 0.5,
            },
          ];
        },
      }),
      pageSize: 10,
    }),
  ]);

  const first = await router.run(createContext('players'));
  const second = await router.run(createContext('players', ['2']));

  assert.match(first.result.messages[0].text, /1\. Player 11 \(#11\)/);
  assert.match(first.result.messages[0].text, /Trang 1\/2/);
  assert.match(second.result.messages[0].text, /Trang 2\/2/);
  assert.equal(first.result.messages[0].channel, 'statistics');
});

test('independent /players handles empty, invalid page, and errors', async () => {
  const empty = createRouter([
    createPlayersCommand({
      playerRepository: createPlayers(),
      statisticsRepository: createStatistics(),
    }),
  ]);
  const failure = createRouter([
    createPlayersCommand({
      playerRepository: createPlayers({
        async list() {
          throw new Error('database unavailable');
        },
      }),
      statisticsRepository: createStatistics(),
    }),
  ]);

  const emptyResult = await empty.run(createContext('players'));
  const invalidResult = await empty.run(createContext('players', ['zero']));
  const failureResult = await failure.run(createContext('players'));

  assert.equal(emptyResult.result.messages[0].text, PLAYERS_MESSAGES.empty);
  assert.equal(invalidResult.result.messages[0].text, PLAYERS_MESSAGES.usage);
  assert.equal(failureResult.result.messages[0].text, PLAYERS_MESSAGES.error);
});

test('independent /player shows detailed stats and missing state', async () => {
  const router = createRouter([
    createPlayerCommand({
      playerRepository: createPlayers({
        async findByNumber(number) {
          return { name: 'Nghia', number };
        },
      }),
      statisticsRepository: createStatistics({
        async findByNumber(number) {
          return number === 10
            ? {
                total_match: 5,
                total_win: 3,
                total_lose: 1,
                total_draw: 1,
                goal: 4,
                assist: 2,
                winrate: 0.6,
              }
            : null;
        },
      }),
    }),
  ]);

  const found = await router.run(createContext('player', ['10']));
  const missing = await router.run(createContext('player', ['11']));
  const invalid = await router.run(createContext('player'));

  assert.match(found.result.messages[0].text, /Cầu thủ: Nghia/);
  assert.match(found.result.messages[0].text, /Tỷ lệ thắng: 60\.0%/);
  assert.match(missing.result.messages[0].text, /số áo 11/);
  assert.equal(invalid.result.messages[0].text, PLAYER_MESSAGES.usage);
});

test('shared /edit-stats parser requires all named totals', () => {
  assert.deepEqual(
    parseEditStatsRequest(['10', 'matches=8', 'wins=5', 'losses=2', 'draws=1']),
    {
      number: 10,
      totals: { matches: 8, wins: 5, losses: 2, draws: 1 },
    }
  );
  assert.equal(parseEditStatsRequest(['10', '8', '5', '2', '1']), null);
  assert.equal(
    parseEditStatsRequest(['10', 'matches=8', 'wins=5', 'wins=2', 'draws=1']),
    null
  );
});

test('independent /edit-stats validates, compares, and replaces totals', async () => {
  const replacements = [];
  const statistics = createStatistics({
    async findByNumber() {
      return {
        total_match: 4,
        total_win: 2,
        total_lose: 1,
        total_draw: 1,
        winrate: 0.5,
      };
    },
    async replaceTotals(number, totals) {
      replacements.push({ number, totals });
    },
  });
  const router = createRouter([
    createEditStatsCommand({ statisticsRepository: statistics }),
  ]);

  const routed = await router.run(
    createContext('edit-stats', [
      '10',
      'matches=8',
      'wins=5',
      'losses=2',
      'draws=1',
    ])
  );
  const invalidTotals = await router.run(
    createContext('edit-stats', [
      '10',
      'matches=8',
      'wins=5',
      'losses=1',
      'draws=1',
    ])
  );

  assert.deepEqual(replacements, [
    {
      number: 10,
      totals: { matches: 8, wins: 5, losses: 2, draws: 1 },
    },
  ]);
  assert.match(routed.result.messages[0].text, /Thống kê cũ/);
  assert.match(routed.result.messages[0].text, /Winrate: 62\.5%/);
  assert.equal(
    invalidTotals.result.messages[0].text,
    EDIT_STATS_MESSAGES.invalidTotals
  );
});

test('independent /edit-stats denies players and reports failures', async () => {
  const statistics = createStatistics({
    async findByNumber() {
      throw new Error('database unavailable');
    },
  });
  const allowed = createRouter([
    createEditStatsCommand({ statisticsRepository: statistics }),
  ]);
  const denied = createRouter(
    [createEditStatsCommand({ statisticsRepository: statistics })],
    { isAdmin: false }
  );
  const args = ['10', 'matches=8', 'wins=5', 'losses=2', 'draws=1'];

  const failure = await allowed.run(createContext('edit-stats', args));
  const deniedResult = await denied.run(
    createContext('edit-stats', args, '999')
  );

  assert.equal(failure.result.messages[0].text, EDIT_STATS_MESSAGES.error);
  assert.equal(
    deniedResult.result.messages[0].text,
    EDIT_STATS_MESSAGES.permissionDenied
  );
});
