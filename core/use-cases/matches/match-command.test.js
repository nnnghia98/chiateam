const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createMatchRepository } = require('../../ports/match-repository');
const {
  createMatchSummaryGenerator,
} = require('../../ports/match-summary-generator');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createPlayerRepository } = require('../../ports/player-repository');
const { createStateRepository } = require('../../ports/state-repository');
const {
  createStatisticsRepository,
} = require('../../ports/statistics-repository');
const {
  MATCH_MESSAGES,
  MATCH_SAVE_STATE_KEYS,
  createMatchCommand,
  parseMatchRequest,
} = require('./match-command');

const NOW = () => new Date(2026, 7, 6, 12);

function createContext(args = [], actorId = '123') {
  return {
    command: 'match',
    args,
    actor: {
      platform: 'telegram',
      externalId: actorId,
      displayName: 'Nghia',
    },
    conversation: { externalId: '456', threadId: null },
  };
}

function createMatches(overrides = {}) {
  return createMatchRepository({
    async findByDate() {
      return null;
    },
    async findWithPlayers() {
      return null;
    },
    async save() {
      return null;
    },
    async updateScore() {
      return null;
    },
    async applyResult() {
      return { unchanged: false, winners: 0, losers: 0 };
    },
    async deleteByDate() {
      return false;
    },
    async list() {
      return [];
    },
    async containsPlayer() {
      return false;
    },
    async addPlayerStat() {},
    async setMvp() {},
    ...overrides,
  });
}

function createPlayers(overrides = {}) {
  return createPlayerRepository({
    async registerActor() {},
    async registerGuest() {},
    async deleteByNumber() {},
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
    async findByNumber() {},
    async findMany() {},
    async replaceTotals() {},
    async incrementGoals() {
      return { ok: true };
    },
    async incrementAssists() {
      return { ok: true };
    },
    ...overrides,
  });
}

function createMatchRouter({
  matches = createMatches(),
  players = createPlayers(),
  statistics = createStatistics(),
  generateSummary = async () => null,
  state = {},
  isAdmin = true,
  loadError,
} = {}) {
  const loads = [];
  let saveCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createMatchCommand({
        matchRepository: matches,
        playerRepository: players,
        statisticsRepository: statistics,
        summaryGenerator: createMatchSummaryGenerator({
          generate: generateSummary,
        }),
        now: NOW,
      }),
    ]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loads.push(keys);
        if (loadError) throw loadError;
        return keys.reduce((selected, key) => {
          selected[key] = state[key];
          return selected;
        }, {});
      },
      async save() {
        saveCount += 1;
        throw new Error('/match must not save next-match state');
      },
    }),
  });

  return { router, loads, getSaveCount: () => saveCount };
}

function createDetailedMatch(overrides = {}) {
  return {
    id: 1,
    match_date: '2026-08-06',
    san: 'Sân A',
    tiensan: 500000,
    home_score: 3,
    away_score: 1,
    homePlayers: [{ label: 'Alice - 10', goals: 2, isMvp: true }],
    awayPlayers: [{ label: 'Bob - 11', assists: 1 }],
    extraPlayers: [],
    ...overrides,
  };
}

test('shared /match parser requires explicit actions', () => {
  assert.deepEqual(parseMatchRequest([], NOW), { kind: 'help' });
  assert.deepEqual(parseMatchRequest(['view'], NOW), {
    kind: 'view',
    date: '2026-08-06',
  });
  assert.deepEqual(parseMatchRequest(['save', '13/08/2026'], NOW), {
    kind: 'save',
    date: '2026-08-13',
  });
  assert.deepEqual(parseMatchRequest(['score', '3-1'], NOW), {
    kind: 'score',
    date: '2026-08-06',
    score: { home: 3, away: 1 },
  });
  assert.deepEqual(parseMatchRequest(['winner', 'home'], NOW), {
    kind: 'result',
    action: 'winner',
    date: '2026-08-06',
    winner: 'HOME',
    loser: 'AWAY',
  });
  assert.deepEqual(parseMatchRequest(['loser', 'HOME', '13/08/2026'], NOW), {
    kind: 'result',
    action: 'loser',
    date: '2026-08-13',
    winner: 'AWAY',
    loser: 'HOME',
  });
  assert.deepEqual(parseMatchRequest(['goal', '10', '2'], NOW), {
    kind: 'goal',
    date: '2026-08-06',
    number: 10,
    count: 2,
  });
  assert.deepEqual(parseMatchRequest(['delete', '13/08/2026'], NOW), {
    kind: 'delete',
    date: '2026-08-13',
  });
  assert.deepEqual(parseMatchRequest(['view', '31/04/2026'], NOW), {
    error: 'INVALID_DATE',
  });
  assert.deepEqual(parseMatchRequest(['score', 'bad'], NOW), {
    error: 'INVALID_SCORE',
  });
  assert.deepEqual(parseMatchRequest(['winner', 'EXTRA'], NOW), {
    error: 'INVALID_SIDE',
  });
});

test('independent /match view reads only match data and includes optional summary', async () => {
  const calls = [];
  const detail = createDetailedMatch({ winner_side: 'HOME' });
  const { router, loads } = createMatchRouter({
    matches: createMatches({
      async findWithPlayers(date) {
        calls.push(date);
        return detail;
      },
    }),
    async generateSummary(match) {
      assert.equal(match, detail);
      return 'HOME chơi rất hay.';
    },
  });

  const routed = await router.run(createContext(['view']));

  assert.deepEqual(calls, ['2026-08-06']);
  assert.deepEqual(loads, []);
  assert.match(routed.result.messages[0].text, /Trận đấu 06\/08\/2026/);
  assert.match(routed.result.messages[0].text, /Alice - 10 \(⭐ 2⚽\)/);
  assert.match(routed.result.messages[0].text, /Team thắng: HOME/);
  assert.match(routed.result.messages[0].text, /HOME chơi rất hay/);
});

test('independent /match save loads only current lineup state', async () => {
  const drafts = [];
  const detail = createDetailedMatch({ home_score: null, away_score: null });
  const { router, loads, getSaveCount } = createMatchRouter({
    state: {
      san: 'Sân A',
      tiensan: 500000,
      teamA: [[1, { name: 'Alice', userId: 1 }]],
      teamB: [['guest:1', { name: 'Bob', memberId: 'guest:1' }]],
      team3C: [],
    },
    players: createPlayers({
      async findByActor(actor) {
        assert.equal(actor.externalId, '1');
        return { id: 101, name: 'Alice', number: 10 };
      },
      async list() {
        return [{ id: 102, name: 'Bob', number: 11 }];
      },
    }),
    matches: createMatches({
      async save(draft) {
        drafts.push(draft);
        return detail;
      },
    }),
  });

  const routed = await router.run(createContext(['save']));

  assert.deepEqual(loads, [MATCH_SAVE_STATE_KEYS]);
  assert.deepEqual(drafts, [
    {
      matchDate: '2026-08-06',
      san: 'Sân A',
      tiensan: 500000,
      homePlayers: [{ playerId: 101, displayName: 'Alice' }],
      awayPlayers: [{ playerId: 102, displayName: 'Bob' }],
      extraPlayers: [],
    },
  ]);
  assert.equal(getSaveCount(), 0);
  assert.equal(routed.result.messages[0].channel, 'announcement');
  assert.match(routed.result.messages[0].text, /Đã lưu trận đấu/);
});

test('independent /match protects every write before loading state', async () => {
  const { router, loads } = createMatchRouter({ isAdmin: false });

  const saveResult = await router.run(createContext(['save'], '999'));
  const winnerResult = await router.run(
    createContext(['winner', 'HOME'], '999')
  );

  assert.equal(
    saveResult.result.messages[0].text,
    MATCH_MESSAGES.permissionDenied
  );
  assert.equal(
    winnerResult.result.messages[0].text,
    MATCH_MESSAGES.permissionDenied
  );
  assert.deepEqual(loads, []);
});

test('independent /match updates score and generates a summary', async () => {
  const calls = [];
  const detail = createDetailedMatch();
  const { router } = createMatchRouter({
    matches: createMatches({
      async findByDate(date) {
        return { id: 1, match_date: date };
      },
      async updateScore(date, home, away) {
        calls.push({ date, home, away });
        return detail;
      },
    }),
    async generateSummary() {
      return 'Một trận đấu vui.';
    },
  });

  const routed = await router.run(createContext(['score', '3-1']));

  assert.deepEqual(calls, [{ date: '2026-08-06', home: 3, away: 1 }]);
  assert.match(routed.result.messages[0].text, /Đã cập nhật tỷ số/);
  assert.match(routed.result.messages[0].text, /Một trận đấu vui/);
});

test('independent /match applies winner or loser to registered player totals once', async () => {
  const calls = [];
  let unchanged = false;
  const detail = createDetailedMatch({
    homePlayers: [
      { playerId: 100, number: 10, label: 'Alice - 10' },
      { playerId: null, number: null, label: 'Guest' },
    ],
    awayPlayers: [{ playerId: 200, number: 11, label: 'Bob - 11' }],
  });
  const { router } = createMatchRouter({
    matches: createMatches({
      async findWithPlayers() {
        return detail;
      },
      async applyResult(date, winner) {
        calls.push({ date, winner });
        return { unchanged, winners: 1, losers: 1 };
      },
    }),
  });

  const updated = await router.run(createContext(['winner', 'HOME']));
  unchanged = true;
  const repeated = await router.run(createContext(['loser', 'AWAY']));

  assert.deepEqual(calls, [
    { date: '2026-08-06', winner: 'HOME' },
    { date: '2026-08-06', winner: 'HOME' },
  ]);
  assert.equal(updated.result.messages[0].channel, 'statistics');
  assert.match(updated.result.messages[0].text, /HOME thắng, AWAY thua/);
  assert.match(updated.result.messages[0].text, /1 cầu thủ thắng/);
  assert.match(repeated.result.messages[0].text, /Không cộng lại/);
});

test('independent /match rejects a result that conflicts with the saved score', async () => {
  let applyCount = 0;
  const createResultRouter = detail =>
    createMatchRouter({
      matches: createMatches({
        async findWithPlayers() {
          return detail;
        },
        async applyResult() {
          applyCount += 1;
          const hasRegisteredPlayers = [
            ...(detail.homePlayers || []),
            ...(detail.awayPlayers || []),
          ].some(player => player.playerId && player.number);
          return hasRegisteredPlayers
            ? { unchanged: false, winners: 1, losers: 1 }
            : {
                unchanged: true,
                winners: 0,
                losers: 0,
                noRegisteredPlayers: true,
              };
        },
      }),
    }).router;

  const conflict = await createResultRouter(
    createDetailedMatch({
      homePlayers: [{ playerId: 1, number: 10 }],
      awayPlayers: [{ playerId: 2, number: 11 }],
    })
  ).run(createContext(['winner', 'AWAY']));
  const draw = await createResultRouter(
    createDetailedMatch({
      home_score: 2,
      away_score: 2,
      homePlayers: [{ playerId: 1, number: 10 }],
      awayPlayers: [{ playerId: 2, number: 11 }],
    })
  ).run(createContext(['winner', 'HOME']));
  const noPlayers = await createResultRouter(
    createDetailedMatch({ home_score: null, away_score: null })
  ).run(createContext(['winner', 'HOME']));

  assert.equal(
    conflict.result.messages[0].text,
    MATCH_MESSAGES.resultScoreConflict
  );
  assert.equal(draw.result.messages[0].text, MATCH_MESSAGES.resultScoreDraw);
  assert.equal(
    noPlayers.result.messages[0].text,
    MATCH_MESSAGES.noRegisteredPlayers
  );
  assert.equal(applyCount, 1);
});

test('independent /match updates goal, assist, and MVP with membership checks', async () => {
  const matchCalls = [];
  const statsCalls = [];
  const matches = createMatches({
    async findByDate() {
      return { id: 50 };
    },
    async containsPlayer(matchId, playerId) {
      assert.deepEqual([matchId, playerId], [50, 100]);
      return true;
    },
    async addPlayerStat(...args) {
      matchCalls.push(args);
    },
    async setMvp(...args) {
      matchCalls.push(['mvp', ...args]);
    },
  });
  const statistics = createStatistics({
    async incrementGoals(...args) {
      statsCalls.push(['goals', ...args]);
      return { ok: true };
    },
    async incrementAssists(...args) {
      statsCalls.push(['assists', ...args]);
      return { ok: true };
    },
  });
  const { router } = createMatchRouter({
    matches,
    statistics,
    players: createPlayers({
      async findByNumber(number) {
        return { id: 100, number };
      },
    }),
  });

  const goal = await router.run(createContext(['goal', '10', '2']));
  const assist = await router.run(createContext(['assist', '10', '1']));
  const mvp = await router.run(createContext(['mvp', '10']));

  assert.deepEqual(matchCalls, [
    [50, 100, 'goals', 2],
    [50, 100, 'assists', 1],
    ['mvp', 50, 100],
  ]);
  assert.deepEqual(statsCalls, [
    ['goals', 10, 2],
    ['assists', 10, 1],
  ]);
  assert.equal(goal.result.messages[0].text, MATCH_MESSAGES.goalUpdated);
  assert.equal(assist.result.messages[0].text, MATCH_MESSAGES.assistUpdated);
  assert.equal(mvp.result.messages[0].text, MATCH_MESSAGES.mvpUpdated);
});

test('independent /match reports missing conditions and partial stat updates', async () => {
  const missingMatch = createMatchRouter();
  const missingPlayer = createMatchRouter({
    matches: createMatches({
      async findByDate() {
        return { id: 1 };
      },
    }),
  });
  const outside = createMatchRouter({
    matches: createMatches({
      async findByDate() {
        return { id: 1 };
      },
      async containsPlayer() {
        return false;
      },
    }),
    players: createPlayers({
      async findByNumber(number) {
        return { id: 2, number };
      },
    }),
  });
  const partial = createMatchRouter({
    matches: createMatches({
      async findByDate() {
        return { id: 1 };
      },
      async containsPlayer() {
        return true;
      },
    }),
    players: createPlayers({
      async findByNumber(number) {
        return { id: 2, number };
      },
    }),
    statistics: createStatistics({
      async incrementGoals() {
        return { ok: false };
      },
    }),
  });

  const missingMatchResult = await missingMatch.router.run(
    createContext(['view'])
  );
  const missingPlayerResult = await missingPlayer.router.run(
    createContext(['goal', '10', '1'])
  );
  const outsideResult = await outside.router.run(
    createContext(['goal', '10', '1'])
  );
  const partialResult = await partial.router.run(
    createContext(['goal', '10', '1'])
  );

  assert.equal(
    missingMatchResult.result.messages[0].text,
    MATCH_MESSAGES.noMatch
  );
  assert.equal(
    missingPlayerResult.result.messages[0].text,
    MATCH_MESSAGES.invalidPlayer
  );
  assert.match(outsideResult.result.messages[0].text, /số 10/);
  assert.equal(
    partialResult.result.messages[0].text,
    MATCH_MESSAGES.statPartial
  );
});

test('independent /match deletes by explicit date and handles invalid requests', async () => {
  const dates = [];
  const { router } = createMatchRouter({
    matches: createMatches({
      async deleteByDate(date) {
        dates.push(date);
        return true;
      },
    }),
  });

  const deleted = await router.run(createContext(['delete', '13/08/2026']));
  const invalidDate = await router.run(createContext(['view', '31/04/2026']));
  const invalidSyntax = await router.run(createContext(['unknown']));

  assert.deepEqual(dates, ['2026-08-13']);
  assert.equal(deleted.result.messages[0].text, MATCH_MESSAGES.deleteSuccess);
  assert.equal(invalidDate.result.messages[0].text, MATCH_MESSAGES.invalidDate);
  assert.equal(invalidSyntax.result.messages[0].text, MATCH_MESSAGES.usage);
});

test('independent /match validates save data and reports state/API failures', async () => {
  const noData = createMatchRouter({
    state: { san: null, tiensan: 0, teamA: [], teamB: [], team3C: [] },
  });
  const loadFailure = createMatchRouter({
    loadError: new Error('storage unavailable'),
  });
  const actionFailure = createMatchRouter({
    matches: createMatches({
      async findWithPlayers() {
        throw new Error('database unavailable');
      },
    }),
  });

  const noDataResult = await noData.router.run(createContext(['save']));
  const loadResult = await loadFailure.router.run(createContext(['save']));
  const actionResult = await actionFailure.router.run(createContext(['view']));

  assert.equal(
    noDataResult.result.messages[0].text,
    MATCH_MESSAGES.noDataToSave
  );
  assert.equal(
    loadResult.result.messages[0].text,
    MATCH_MESSAGES.loadStateError
  );
  assert.equal(actionResult.result.messages[0].text, MATCH_MESSAGES.error);
});
