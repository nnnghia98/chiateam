const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  WINNER_MESSAGES,
  WINNER_STATE_KEYS,
  createWinnerCommand,
  parseWinnerRequest,
} = require('./winner-command');

const EMPTY_RESULT_STATE = Object.freeze({
  tiensan: 0,
  tiennuoc: 0,
  teamThua: null,
  teamA: [],
  teamB: [],
  team3A: [],
  team3B: [],
  team3C: [],
});

function createContext(args = [], actorId = '123') {
  return {
    command: 'winner',
    args,
    actor: {
      platform: 'telegram',
      externalId: actorId,
      displayName: 'Nghia',
      username: 'nghia',
    },
    conversation: {
      externalId: '456',
      threadId: null,
    },
  };
}

function createWinnerRouter({
  state = { ...EMPTY_RESULT_STATE },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createWinnerCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, WINNER_STATE_KEYS);
        if (loadError) throw loadError;
        return state;
      },
      async save(changes) {
        if (saveError) throw saveError;
        saves.push(changes);
        Object.assign(state, changes);
        return state;
      },
    }),
  });

  return { router, saves, state, getLoadCount: () => loadCount };
}

test('shared /winner parser accepts reads and HOME or AWAY writes', () => {
  assert.deepEqual(parseWinnerRequest([]), { kind: 'read' });
  assert.deepEqual(parseWinnerRequest(['home']), {
    kind: 'write',
    winner: 'HOME',
    loser: 'AWAY',
  });
  assert.deepEqual(parseWinnerRequest(['AWAY']), {
    kind: 'write',
    winner: 'AWAY',
    loser: 'HOME',
  });
  assert.equal(parseWinnerRequest(['EXTRA']), null);
  assert.equal(parseWinnerRequest(['HOME', 'AWAY']), null);
});

test('independent /winner reports missing and current results to players', async () => {
  const missing = createWinnerRouter({ isAdmin: false });
  const current = createWinnerRouter({
    state: { ...EMPTY_RESULT_STATE, teamThua: 'AWAY' },
    isAdmin: false,
  });

  const missingResult = await missing.router.run(createContext([], '999'));
  const currentResult = await current.router.run(createContext([], '999'));

  assert.equal(missingResult.result.messages[0].text, WINNER_MESSAGES.noWinner);
  assert.equal(
    currentResult.result.messages[0].text,
    '📋 Team thắng hiện tại: HOME'
  );
  assert.equal(currentResult.result.messages[0].segments[1].bold, true);
  assert.equal(missing.saves.length, 0);
  assert.equal(current.saves.length, 0);
});

test('independent /winner denies player writes before loading state', async () => {
  const { router, saves, getLoadCount } = createWinnerRouter({
    isAdmin: false,
  });

  const routed = await router.run(createContext(['HOME'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    WINNER_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /winner saves the inverse loser atomically', async () => {
  const { router, saves, state } = createWinnerRouter();

  const routed = await router.run(createContext(['HOME']));

  assert.deepEqual(saves, [{ teamThua: 'AWAY' }]);
  assert.equal(state.teamThua, 'AWAY');
  assert.equal(routed.result.messages[0].text, '✅ Đã chọn team thắng: HOME');
  assert.equal(routed.result.messages[0].channel, 'default');
});

test('independent /winner saves and announces the two-team fee split', async () => {
  const { router, saves, state } = createWinnerRouter({
    state: {
      ...EMPTY_RESULT_STATE,
      tiensan: 300000,
      tiennuoc: 60000,
      teamA: [[1, { name: 'Alice' }]],
      teamB: [
        [2, { name: 'Bob' }],
        [3, { name: 'Carol' }],
      ],
    },
  });

  const routed = await router.run(createContext(['HOME']));
  const message = routed.result.messages[0];

  assert.deepEqual(saves, [{ teamThua: 'AWAY' }]);
  assert.equal(state.teamThua, 'AWAY');
  assert.equal(message.channel, 'announcement');
  assert.match(message.text, /HOME \(thắng\):\nAlice/);
  assert.match(message.text, /AWAY \(thua\):\nBob\nCarol/);
  assert.match(message.text, /100\.000 \+ 30\.000 = 130\.000 VND/);
});

test('independent /winner rejects a three-team-only result without saving', async () => {
  const { router, saves, state } = createWinnerRouter({
    state: {
      ...EMPTY_RESULT_STATE,
      team3A: [[1, { name: 'Alice' }]],
    },
  });

  const routed = await router.run(createContext(['HOME']));

  assert.equal(
    routed.result.messages[0].text,
    WINNER_MESSAGES.threeTeamUnsupported
  );
  assert.equal(state.teamThua, null);
  assert.equal(saves.length, 0);
});

test('independent /winner handles invalid input, state, and repository errors', async () => {
  const invalidInput = createWinnerRouter();
  const invalidState = createWinnerRouter({
    state: { ...EMPTY_RESULT_STATE, teamThua: 'EXTRA' },
  });
  const loadFailure = createWinnerRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createWinnerRouter({
    saveError: new Error('API unavailable'),
  });

  const inputResult = await invalidInput.router.run(createContext(['EXTRA']));
  const stateResult = await invalidState.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['HOME']));

  assert.equal(inputResult.result.messages[0].text, WINNER_MESSAGES.usage);
  assert.equal(stateResult.result.messages[0].text, WINNER_MESSAGES.loadError);
  assert.equal(loadResult.result.messages[0].text, WINNER_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, WINNER_MESSAGES.saveError);
});
