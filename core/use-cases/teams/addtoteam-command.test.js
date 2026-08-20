const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  ADDTOTEAM_MESSAGES,
  ADDTOTEAM_STATE_KEYS,
  createAddtoteamCommand,
  parseAddtoteamRequest,
  parseMemberSelection,
} = require('./addtoteam-command');

function createBench(count) {
  return Array.from({ length: count }, (_, index) => [
    index + 1,
    { name: `Player ${index + 1}`, userId: index + 1 },
  ]);
}

function createState(overrides = {}) {
  return {
    bench: [],
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
    command: 'addtoteam',
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

function createAddtoteamRouter({
  state = createState(),
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createAddtoteamCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ADDTOTEAM_STATE_KEYS);
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

test('shared /addtoteam request parser maps only valid mode targets', () => {
  assert.equal(parseAddtoteamRequest(['HOME']).target.key, 'teamA');
  assert.equal(parseAddtoteamRequest(['2', 'AWAY']).target.key, 'teamB');
  assert.equal(parseAddtoteamRequest(['3', 'HOME']).target.key, 'team3A');
  assert.equal(parseAddtoteamRequest(['3', 'AWAY']).target.key, 'team3B');
  assert.equal(parseAddtoteamRequest(['3', 'EXTRA']).target.key, 'team3C');
  assert.equal(parseAddtoteamRequest(['EXTRA']), null);
  assert.equal(parseAddtoteamRequest(['2', 'EXTRA']), null);
  assert.equal(parseAddtoteamRequest(['4', 'HOME']), null);
});

test('shared /addtoteam selection supports numbers, ranges, names, and all', () => {
  const entries = [
    { index: 0, name: 'Alice', member: { name: 'Alice', userId: 1 } },
    { index: 1, name: 'Bob Smith', member: { name: 'Bob Smith', userId: 2 } },
    { index: 2, name: 'Carol', member: { name: 'Carol', userId: 3 } },
    { index: 3, name: 'Dan', member: { name: 'Dan', userId: 4 } },
  ];

  assert.deepEqual(
    parseMemberSelection('1, 3-4, "Bob"', entries).map(entry => entry.name),
    ['Alice', 'Bob Smith', 'Carol', 'Dan']
  );
  assert.deepEqual(
    parseMemberSelection('smith', entries).map(entry => entry.name),
    ['Bob Smith']
  );
  assert.deepEqual(parseMemberSelection('all', entries), entries);
  assert.equal(parseMemberSelection('20, Nobody', entries), null);
});

test('independent /addtoteam shows paginated member actions', async () => {
  const { router, saves } = createAddtoteamRouter({
    state: createState({ bench: createBench(12) }),
  });

  const firstPage = await router.run(createContext(['3', 'EXTRA']));
  const secondPage = await router.run(
    createContext(['3', 'EXTRA', 'page', '2'])
  );

  assert.equal(
    firstPage.result.messages[0].text,
    '📋 Chọn member để thêm vào Extra:\nTrang 1/2'
  );
  assert.equal(firstPage.result.messages[0].actions.length, 11);
  assert.deepEqual(firstPage.result.messages[0].actions[0], {
    id: 'addtoteam_select_3_EXTRA_1',
    label: '1. Player 1',
    command: '/addtoteam 3 EXTRA 1',
  });
  assert.equal(firstPage.result.messages[0].actions.at(-1).label, 'Tiếp >');
  assert.equal(secondPage.result.messages[0].actions[0].label, '11. Player 11');
  assert.equal(secondPage.result.messages[0].actions.at(-1).label, '< Trước');
  assert.equal(saves.length, 0);
});

test('independent /addtoteam saves one target team using stable identities', async () => {
  const bench = [
    [1, { name: 'Alice', userId: 1 }],
    [2, { name: 'Bob', userId: 2 }],
    ['guest:1', { name: 'Guest', memberId: 'guest:1' }],
  ];
  const teamA = [['legacy-key', { name: 'Alice copy', userId: 1 }]];
  const originalBench = structuredClone(bench);
  const originalTeam = structuredClone(teamA);
  const { router, saves } = createAddtoteamRouter({
    state: createState({ bench, teamA }),
  });

  const routed = await router.run(createContext(['HOME', 'all']));

  assert.deepEqual(bench, originalBench);
  assert.deepEqual(teamA, originalTeam);
  assert.deepEqual(saves, [
    {
      teamA: [
        ['legacy-key', { name: 'Alice copy', userId: 1 }],
        ['team:tele:2', { name: 'Bob', userId: 2 }],
        ['team:member:guest:1', { name: 'Guest', memberId: 'guest:1' }],
      ],
    },
  ]);
  assert.equal(routed.result.messages[0].channel, 'source');
  assert.match(routed.result.messages[0].text, /Đã bỏ qua 1 member/);
  assert.match(routed.result.messages[0].text, /Đã thêm 2 member/);
  assert.match(routed.result.messages[0].text, /Home hiện tại/);
});

test('independent /addtoteam writes only the selected three-team target', async () => {
  const state = createState({ bench: createBench(2) });
  const { router, saves } = createAddtoteamRouter({ state });

  await router.run(createContext(['3', 'EXTRA', '2']));

  assert.deepEqual(Object.keys(saves[0]), ['team3C']);
  assert.deepEqual(saves[0].team3C, [
    ['team:tele:2', { name: 'Player 2', userId: 2 }],
  ]);
  assert.deepEqual(state.team3A, []);
  assert.deepEqual(state.team3B, []);
  assert.deepEqual(state.teamA, []);
  assert.deepEqual(state.teamB, []);
});

test('independent /addtoteam reports all duplicates without saving', async () => {
  const { router, saves } = createAddtoteamRouter({
    state: createState({
      bench: [[1, { name: 'Alice', userId: 1 }]],
      teamA: [['saved', { name: 'Old Alice', userId: 1 }]],
    }),
  });

  const routed = await router.run(createContext(['2', 'HOME', '1']));

  assert.equal(
    routed.result.messages[0].text,
    '⚠️ Tất cả 1 member đã có trong Home rồi.'
  );
  assert.equal(saves.length, 0);
});

test('independent /addtoteam handles usage, invalid input, and empty bench', async () => {
  const validState = createState({ bench: createBench(2) });
  const noArgs = createAddtoteamRouter({ state: validState });
  const invalidTarget = createAddtoteamRouter({ state: validState });
  const invalidSelection = createAddtoteamRouter({ state: validState });
  const empty = createAddtoteamRouter();

  const noArgsResult = await noArgs.router.run(createContext());
  const targetResult = await invalidTarget.router.run(
    createContext(['2', 'EXTRA'])
  );
  const selectionResult = await invalidSelection.router.run(
    createContext(['HOME', '99'])
  );
  const emptyResult = await empty.router.run(createContext(['HOME']));

  assert.equal(noArgsResult.result.messages[0].text, ADDTOTEAM_MESSAGES.usage);
  assert.equal(targetResult.result.messages[0].text, ADDTOTEAM_MESSAGES.usage);
  assert.equal(
    selectionResult.result.messages[0].text,
    ADDTOTEAM_MESSAGES.invalidSelection
  );
  assert.equal(
    emptyResult.result.messages[0].text,
    ADDTOTEAM_MESSAGES.emptyBench
  );
  assert.equal(noArgs.saves.length, 0);
  assert.equal(invalidTarget.saves.length, 0);
  assert.equal(invalidSelection.saves.length, 0);
  assert.equal(empty.saves.length, 0);
});

test('independent /addtoteam handles invalid, failed load, and failed save', async () => {
  const invalid = createAddtoteamRouter({
    state: createState({ bench: createBench(1), teamA: [['broken']] }),
  });
  const loadFailure = createAddtoteamRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createAddtoteamRouter({
    state: createState({ bench: createBench(1) }),
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext(['HOME']));
  const loadResult = await loadFailure.router.run(createContext(['HOME']));
  const saveResult = await saveFailure.router.run(createContext(['HOME', '1']));

  assert.equal(
    invalidResult.result.messages[0].text,
    ADDTOTEAM_MESSAGES.loadError
  );
  assert.equal(
    loadResult.result.messages[0].text,
    ADDTOTEAM_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    ADDTOTEAM_MESSAGES.saveError
  );
  assert.equal(invalid.saves.length, 0);
  assert.equal(loadFailure.saves.length, 0);
  assert.equal(saveFailure.saves.length, 0);
});

test('independent /addtoteam blocks non-admin actors before state load', async () => {
  const { router, saves, getLoadCount } = createAddtoteamRouter({
    state: createState({ bench: createBench(1) }),
    isAdmin: false,
  });

  const routed = await router.run(createContext(['HOME', '1'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    ADDTOTEAM_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});
