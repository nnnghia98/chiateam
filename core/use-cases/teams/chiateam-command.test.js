const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CHIATEAM_MESSAGES,
  CHIATEAM_STATE_KEYS,
  createChiateamCommand,
} = require('./chiateam-command');

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
    manifest: null,
    ...overrides,
  };
}

function createContext(args = [], actorId = '123') {
  return {
    command: 'chiateam',
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

function createChiateamRouter({
  state = createState(),
  isAdmin = true,
  loadError,
  saveError,
  random = () => 0,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createChiateamCommand({ random })]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, CHIATEAM_STATE_KEYS);
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

test('independent /chiateam assigns two balanced teams atomically', async () => {
  const bench = createBench(5);
  const originalBench = structuredClone(bench);
  const { router, saves } = createChiateamRouter({
    state: createState({ bench }),
  });

  const routed = await router.run(createContext());

  assert.equal(saves.length, 1);
  assert.deepEqual(Object.keys(saves[0]).sort(), ['teamA', 'teamB']);
  assert.equal(saves[0].teamA.length + saves[0].teamB.length, 5);
  assert.ok(Math.abs(saves[0].teamA.length - saves[0].teamB.length) <= 1);
  assert.deepEqual(bench, originalBench);
  assert.equal(routed.result.messages[0].channel, 'announcement');
  assert.match(routed.result.messages[0].text, /Chia team/);
  assert.match(routed.result.messages[0].text, /HOME \(3\)|HOME \(2\)/);
});

test('independent /chiateam 3 only writes the three-team stack', async () => {
  const existingTwoTeam = [[99, { name: 'Existing', userId: 99 }]];
  const state = createState({
    bench: createBench(7),
    teamA: existingTwoTeam,
  });
  const { router, saves } = createChiateamRouter({ state });

  const routed = await router.run(createContext(['3']));

  assert.deepEqual(Object.keys(saves[0]).sort(), [
    'team3A',
    'team3B',
    'team3C',
  ]);
  assert.equal(
    saves[0].team3A.length + saves[0].team3B.length + saves[0].team3C.length,
    7
  );
  assert.ok(
    Math.max(
      saves[0].team3A.length,
      saves[0].team3B.length,
      saves[0].team3C.length
    ) -
      Math.min(
        saves[0].team3A.length,
        saves[0].team3B.length,
        saves[0].team3C.length
      ) <=
      1
  );
  assert.deepEqual(state.teamA, existingTwoTeam);
  assert.match(routed.result.messages[0].text, /Chia 3 team/);
});

test('independent /chiateam keeps existing assignments and fills smaller teams', async () => {
  const bench = createBench(4);
  const state = createState({
    bench,
    teamA: [bench[0], bench[1]],
  });
  const { router, saves } = createChiateamRouter({ state });

  await router.run(createContext(['2']));

  assert.equal(saves[0].teamA.length, 2);
  assert.equal(saves[0].teamB.length, 2);
  assert.deepEqual(saves[0].teamA, [bench[0], bench[1]]);

  const rerun = await router.run(createContext());

  assert.equal(rerun.result.messages[0].text, CHIATEAM_MESSAGES.allAssigned);
  assert.equal(saves.length, 1);
});

test('independent /chiateam applies stored manifest relations', async () => {
  const state = createState({
    bench: createBench(4),
    manifest: [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Player 1' },
          { identity: 'tele:2', name: 'Player 2' },
        ],
      },
      {
        relation: 'different',
        players: [
          { identity: 'tele:3', name: 'Player 3' },
          { identity: 'tele:4', name: 'Player 4' },
        ],
      },
    ],
  });
  const { router, saves } = createChiateamRouter({ state });

  await router.run(createContext());

  const teamFor = userId =>
    saves[0].teamA.some(([, member]) => member.userId === userId)
      ? 'HOME'
      : 'AWAY';

  assert.equal(teamFor(1), teamFor(2));
  assert.notEqual(teamFor(3), teamFor(4));
});

test('independent /chiateam reports invalid mode and missing players', async () => {
  const invalidMode = createChiateamRouter({
    state: createState({ bench: createBench(3) }),
  });
  const twoTeam = createChiateamRouter({
    state: createState({ bench: createBench(1) }),
  });
  const threeTeam = createChiateamRouter({
    state: createState({ bench: createBench(2) }),
  });

  const invalidResult = await invalidMode.router.run(createContext(['4']));
  const twoResult = await twoTeam.router.run(createContext());
  const threeResult = await threeTeam.router.run(createContext(['3']));

  assert.equal(invalidResult.result.messages[0].text, CHIATEAM_MESSAGES.usage);
  assert.equal(twoResult.result.messages[0].text, CHIATEAM_MESSAGES.notEnough);
  assert.equal(
    threeResult.result.messages[0].text,
    CHIATEAM_MESSAGES.notEnoughThree
  );
  assert.equal(invalidMode.saves.length, 0);
  assert.equal(twoTeam.saves.length, 0);
  assert.equal(threeTeam.saves.length, 0);
});

test('independent /chiateam rejects conflicting manifests', async () => {
  const { router, saves } = createChiateamRouter({
    state: createState({
      bench: createBench(2),
      manifest: [
        {
          relation: 'same',
          players: [{ identity: 'tele:1' }, { identity: 'tele:2' }],
        },
        {
          relation: 'different',
          players: [{ identity: 'tele:1' }, { identity: 'tele:2' }],
        },
      ],
    }),
  });

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    CHIATEAM_MESSAGES.manifestConflict
  );
  assert.equal(saves.length, 0);
});

test('independent /chiateam rejects non-admin actors before loading state', async () => {
  const { router, saves, getLoadCount } = createChiateamRouter({
    state: createState({ bench: createBench(2) }),
    isAdmin: false,
  });

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    CHIATEAM_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /chiateam handles invalid state and repository failures', async () => {
  const invalidState = createChiateamRouter({
    state: createState({ bench: [['broken']] }),
  });
  const invalidManifest = createChiateamRouter({
    state: createState({
      bench: createBench(2),
      manifest: { relation: 'same', players: [{ identity: 'tele:1' }] },
    }),
  });
  const loadFailure = createChiateamRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createChiateamRouter({
    state: createState({ bench: createBench(2) }),
    saveError: new Error('API unavailable'),
  });

  const invalidStateResult = await invalidState.router.run(createContext());
  const invalidManifestResult =
    await invalidManifest.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext());

  assert.equal(
    invalidStateResult.result.messages[0].text,
    CHIATEAM_MESSAGES.loadError
  );
  assert.equal(
    invalidManifestResult.result.messages[0].text,
    CHIATEAM_MESSAGES.loadError
  );
  assert.equal(loadResult.result.messages[0].text, CHIATEAM_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, CHIATEAM_MESSAGES.saveError);
});
