const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createMatchRepository } = require('../../ports/match-repository');
const { createStateRepository } = require('../../ports/state-repository');
const {
  MATCHES_MESSAGES,
  createMatchesCommand,
  parseMatchesRequest,
} = require('./matches-command');

function createRepository(list) {
  return createMatchRepository({
    async findByDate() {},
    async findWithPlayers() {},
    async save() {},
    async updateScore() {},
    async deleteByDate() {},
    list,
    async containsPlayer() {},
    async addPlayerStat() {},
    async setMvp() {},
  });
}

function createContext(args = []) {
  return {
    command: 'matches',
    args,
    actor: { platform: 'telegram', externalId: '123' },
    conversation: { externalId: '456', threadId: null },
  };
}

function createRouter(list) {
  return createCommandRouter({
    registry: createCommandRegistry([
      createMatchesCommand({ matchRepository: createRepository(list) }),
    ]),
    stateRepository: createStateRepository({
      async load() {
        throw new Error('/matches must not load bot state');
      },
      async save() {},
    }),
  });
}

test('shared /matches parser bounds limit and page', () => {
  assert.deepEqual(parseMatchesRequest([]), { limit: 10, page: 1, offset: 0 });
  assert.deepEqual(parseMatchesRequest(['5', '3']), {
    limit: 5,
    page: 3,
    offset: 10,
  });
  assert.equal(parseMatchesRequest(['21']), null);
  assert.equal(parseMatchesRequest(['5', '0']), null);
});

test('independent /matches lists a requested page', async () => {
  const calls = [];
  const router = createRouter(async (limit, offset) => {
    calls.push({ limit, offset });
    return [
      { match_date: '2026-08-06', home_score: 3, away_score: 1 },
      { match_date: '2026-07-30', home_score: null, away_score: null },
    ];
  });

  const routed = await router.run(createContext(['5', '2']));

  assert.deepEqual(calls, [{ limit: 5, offset: 5 }]);
  assert.match(routed.result.messages[0].text, /06\/08\/2026 3 - 1/);
  assert.match(routed.result.messages[0].text, /Trang 2/);
});

test('independent /matches handles empty, invalid, and failed requests', async () => {
  const empty = createRouter(async () => []);
  const failure = createRouter(async () => {
    throw new Error('database unavailable');
  });

  const emptyResult = await empty.run(createContext());
  const invalidResult = await empty.run(createContext(['21']));
  const failedResult = await failure.run(createContext());

  assert.equal(emptyResult.result.messages[0].text, MATCHES_MESSAGES.empty);
  assert.equal(invalidResult.result.messages[0].text, MATCHES_MESSAGES.usage);
  assert.equal(failedResult.result.messages[0].text, MATCHES_MESSAGES.error);
});
