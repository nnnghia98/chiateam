const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CLEARTEAM_MESSAGES,
  CLEARTEAM_STATE_KEYS,
  createClearteamCommand,
  parseClearteamRequest,
} = require('./clearteam-command');

function createTeam(count, prefix = 'Player') {
  return Array.from({ length: count }, (_, index) => [
    index + 1,
    { name: `${prefix} ${index + 1}`, userId: index + 1 },
  ]);
}

function createState(overrides = {}) {
  return {
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    ...overrides,
  };
}

function createContext(args = [], actorId = '123') {
  return {
    command: 'clearteam',
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

function createClearteamRouter({
  state = createState(),
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createClearteamCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, CLEARTEAM_STATE_KEYS);
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

  return {
    router,
    saves,
    state,
    getLoadCount: () => loadCount,
  };
}

test('shared /clearteam parser separates stack and member actions', () => {
  assert.deepEqual(parseClearteamRequest(['2']), {
    kind: 'confirmStack',
    mode: 2,
    stackKeys: ['teamA', 'teamB'],
  });
  assert.deepEqual(parseClearteamRequest(['3', 'confirm']), {
    kind: 'clearStack',
    mode: 3,
    stackKeys: ['team3A', 'team3B', 'team3C'],
  });
  assert.equal(parseClearteamRequest(['HOME']).target.key, 'teamA');
  assert.equal(
    parseClearteamRequest(['3', 'EXTRA', 'all']).target.key,
    'team3C'
  );
  assert.equal(parseClearteamRequest(['EXTRA']), null);
  assert.equal(parseClearteamRequest(['2', 'EXTRA']), null);
});

test('independent /clearteam shows usage without changing teams', async () => {
  const teamA = createTeam(1);
  const { router, saves } = createClearteamRouter({
    state: createState({ teamA }),
  });

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, CLEARTEAM_MESSAGES.usage);
  assert.equal(teamA.length, 1);
  assert.equal(saves.length, 0);
});

test('independent /clearteam requires confirmation before stack deletion', async () => {
  const { router, saves } = createClearteamRouter({
    state: createState({ teamA: createTeam(1) }),
  });

  const routed = await router.run(createContext(['2']));

  assert.match(routed.result.messages[0].text, /Xóa toàn bộ 2-team stack/);
  assert.deepEqual(routed.result.messages[0].actions, [
    {
      id: 'clearteam_confirm_2',
      label: '✅ Xác nhận',
      command: '/clearteam 2 confirm',
    },
    {
      id: 'clearteam_cancel_2',
      label: 'Hủy',
      command: '/clearteam 2 cancel',
    },
  ]);
  assert.equal(saves.length, 0);
});

test('independent /clearteam clears the two-team stack atomically', async () => {
  const teamA = createTeam(1, 'Home');
  const teamB = createTeam(1, 'Away');
  const team3A = createTeam(1, 'Three');
  const originalA = structuredClone(teamA);
  const originalB = structuredClone(teamB);
  const state = createState({ teamA, teamB, team3A });
  const { router, saves } = createClearteamRouter({ state });

  const routed = await router.run(createContext(['2', 'confirm']));

  assert.deepEqual(saves, [{ teamA: [], teamB: [] }]);
  assert.deepEqual(teamA, originalA);
  assert.deepEqual(teamB, originalB);
  assert.equal(state.team3A, team3A);
  assert.equal(
    routed.result.messages[0].text,
    CLEARTEAM_MESSAGES.stack2Success
  );
});

test('independent /clearteam clears only the three-team stack atomically', async () => {
  const teamA = createTeam(1, 'Two');
  const { router, saves, state } = createClearteamRouter({
    state: createState({
      teamA,
      team3A: createTeam(1, 'Home'),
      team3B: createTeam(1, 'Away'),
      team3C: createTeam(1, 'Extra'),
    }),
  });

  const routed = await router.run(createContext(['3', 'confirm']));

  assert.deepEqual(saves, [{ team3A: [], team3B: [], team3C: [] }]);
  assert.equal(state.teamA, teamA);
  assert.equal(
    routed.result.messages[0].text,
    CLEARTEAM_MESSAGES.stack3Success
  );
});

test('independent /clearteam can cancel stack deletion', async () => {
  const teamA = createTeam(1);
  const { router, saves } = createClearteamRouter({
    state: createState({ teamA }),
  });

  const routed = await router.run(createContext(['2', 'cancel']));

  assert.equal(routed.result.messages[0].text, CLEARTEAM_MESSAGES.cancelled);
  assert.equal(teamA.length, 1);
  assert.equal(saves.length, 0);
});

test('independent /clearteam shows paginated team-member actions', async () => {
  const { router, saves } = createClearteamRouter({
    state: createState({ team3C: createTeam(12) }),
  });

  const firstPage = await router.run(createContext(['3', 'EXTRA']));
  const secondPage = await router.run(
    createContext(['3', 'EXTRA', 'page', '2'])
  );

  assert.equal(
    firstPage.result.messages[0].text,
    '👤 Chọn member cần xóa khỏi Extra:\nTrang 1/2'
  );
  assert.equal(firstPage.result.messages[0].actions.length, 11);
  assert.deepEqual(firstPage.result.messages[0].actions[0], {
    id: 'clearteam_select_3_EXTRA_1',
    label: '1. Player 1',
    command: '/clearteam 3 EXTRA 1',
  });
  assert.equal(firstPage.result.messages[0].actions.at(-1).label, 'Tiếp >');
  assert.equal(secondPage.result.messages[0].actions[0].label, '11. Player 11');
  assert.equal(secondPage.result.messages[0].actions.at(-1).label, '< Trước');
  assert.equal(saves.length, 0);
});

test('independent /clearteam removes selected members from one team', async () => {
  const teamA = [
    [1, { name: 'Alice', userId: 1 }],
    [2, { name: 'Bob Smith', userId: 2 }],
    [3, { name: 'Carol', userId: 3 }],
    [4, { name: 'Dan', userId: 4 }],
  ];
  const teamB = createTeam(1, 'Away');
  const originalA = structuredClone(teamA);
  const { router, saves, state } = createClearteamRouter({
    state: createState({ teamA, teamB }),
  });

  const routed = await router.run(
    createContext(['HOME', '1,', '3-4,', 'smith'])
  );

  assert.deepEqual(teamA, originalA);
  assert.deepEqual(saves, [{ teamA: [] }]);
  assert.equal(state.teamB, teamB);
  assert.match(routed.result.messages[0].text, /Đã xóa 4 member/);
  assert.match(routed.result.messages[0].text, /Bob Smith/);
});

test('independent /clearteam all clears only one selected team', async () => {
  const team3B = createTeam(2, 'Away');
  const team3C = createTeam(1, 'Extra');
  const { router, saves, state } = createClearteamRouter({
    state: createState({ team3B, team3C }),
  });

  await router.run(createContext(['3', 'AWAY', 'all']));

  assert.deepEqual(saves, [{ team3B: [] }]);
  assert.equal(state.team3C, team3C);
});

test('independent /clearteam reports empty and invalid requests', async () => {
  const emptyStack = createClearteamRouter();
  const emptyTeam = createClearteamRouter({
    state: createState({ teamB: createTeam(1) }),
  });
  const invalidTarget = createClearteamRouter({
    state: createState({ team3C: createTeam(1) }),
  });
  const invalidSelection = createClearteamRouter({
    state: createState({ teamA: createTeam(1) }),
  });

  const stackResult = await emptyStack.router.run(createContext(['2']));
  const teamResult = await emptyTeam.router.run(createContext(['HOME']));
  const targetResult = await invalidTarget.router.run(
    createContext(['2', 'EXTRA'])
  );
  const selectionResult = await invalidSelection.router.run(
    createContext(['HOME', '99'])
  );

  assert.equal(
    stackResult.result.messages[0].text,
    CLEARTEAM_MESSAGES.stack2Empty
  );
  assert.equal(teamResult.result.messages[0].text, '⚠️ Home trống.');
  assert.equal(targetResult.result.messages[0].text, CLEARTEAM_MESSAGES.usage);
  assert.equal(
    selectionResult.result.messages[0].text,
    CLEARTEAM_MESSAGES.invalidSelection
  );
});

test('independent /clearteam handles invalid state and repository failures', async () => {
  const invalid = createClearteamRouter({
    state: createState({ teamA: [['broken']] }),
  });
  const loadFailure = createClearteamRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createClearteamRouter({
    state: createState({ teamA: createTeam(1) }),
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext(['HOME']));
  const loadResult = await loadFailure.router.run(createContext(['HOME']));
  const saveResult = await saveFailure.router.run(
    createContext(['HOME', 'all'])
  );

  assert.equal(
    invalidResult.result.messages[0].text,
    CLEARTEAM_MESSAGES.loadError
  );
  assert.equal(
    loadResult.result.messages[0].text,
    CLEARTEAM_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    CLEARTEAM_MESSAGES.saveError
  );
  assert.equal(invalid.saves.length, 0);
  assert.equal(loadFailure.saves.length, 0);
  assert.equal(saveFailure.saves.length, 0);
});

test('independent /clearteam blocks non-admin actors before state load', async () => {
  const { router, saves, getLoadCount } = createClearteamRouter({
    state: createState({ teamA: createTeam(1) }),
    isAdmin: false,
  });

  const routed = await router.run(createContext(['HOME', '1'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    CLEARTEAM_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});
