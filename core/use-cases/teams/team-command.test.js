const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const { TEAM_MESSAGES, createTeamCommand } = require('./team-command');

const EMPTY_TEAMS = Object.freeze({
  teamA: [],
  teamB: [],
  team3A: [],
  team3B: [],
  team3C: [],
});

function createContext(args = []) {
  return {
    command: 'team',
    args,
    actor: {
      platform: 'telegram',
      externalId: '123',
      displayName: 'Nghia',
      username: 'nghia',
    },
    conversation: {
      externalId: '456',
      threadId: null,
    },
  };
}

function createTeamRouter(load) {
  return createCommandRouter({
    registry: createCommandRegistry([createTeamCommand()]),
    stateRepository: createStateRepository({
      load,
      async save() {
        throw new Error('/team must not save state');
      },
    }),
  });
}

test('independent /team and /team 2 return the two-team empty state', async () => {
  const router = createTeamRouter(async () => ({ ...EMPTY_TEAMS }));

  const defaultResult = await router.run(createContext());
  const explicitResult = await router.run(createContext(['2']));

  assert.equal(defaultResult.result.messages[0].text, TEAM_MESSAGES.noTwoTeam);
  assert.equal(explicitResult.result.messages[0].text, TEAM_MESSAGES.noTwoTeam);
});

test('independent /team returns the current two-team roster', async () => {
  const state = {
    ...EMPTY_TEAMS,
    teamA: [[1, { name: 'Home_player' }]],
    teamB: [[2, { name: 'Away *player*' }]],
  };
  const originalState = structuredClone(state);
  const router = createTeamRouter(async () => state);

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    '🎲 Team hiện tại 🎲\n\n' +
      '⚪ HOME (1):\nHome_player\n\n' +
      '⚫ AWAY (1):\nAway *player*'
  );
  assert.deepEqual(state, originalState);
});

test('independent /team 3 handles empty and populated three-team state', async () => {
  const states = [
    { ...EMPTY_TEAMS },
    {
      ...EMPTY_TEAMS,
      team3A: [[1, { name: 'Home' }]],
      team3C: [[3, 'Extra']],
    },
  ];
  const router = createTeamRouter(async () => states.shift());

  const empty = await router.run(createContext(['3']));
  const populated = await router.run(createContext(['3']));

  assert.equal(empty.result.messages[0].text, TEAM_MESSAGES.noThreeTeam);
  assert.equal(
    populated.result.messages[0].text,
    '🎲 3 Team hiện tại 🎲\n\n' +
      '⚪ HOME (1):\nHome\n\n' +
      '⚫ AWAY (0):\n(trống)\n\n' +
      '🟠 EXT (1):\nExtra'
  );
});

test('independent /team rejects unsupported arguments', async () => {
  const router = createTeamRouter(async () => ({ ...EMPTY_TEAMS }));

  const routed = await router.run(createContext(['four']));

  assert.equal(routed.result.messages[0].text, TEAM_MESSAGES.usage);
});

test('independent /team returns its repository error reply', async () => {
  const router = createTeamRouter(async () => {
    throw new Error('API unavailable');
  });

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, TEAM_MESSAGES.loadError);
});
