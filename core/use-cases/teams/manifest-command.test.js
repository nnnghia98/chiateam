const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  MANIFEST_MESSAGES,
  MANIFEST_STATE_KEYS,
  createManifestCommand,
  parseManifestRelation,
  parseManifestRequest,
} = require('./manifest-command');

function createBench(count) {
  return Array.from({ length: count }, (_, index) => [
    index + 1,
    { name: `Player ${index + 1}`, userId: index + 1 },
  ]);
}

function createContext(args = [], actorId = '123') {
  return {
    command: 'manifest',
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

function createManifestRouter({
  state = { bench: [], manifest: null },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createManifestCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, MANIFEST_STATE_KEYS);
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

test('shared /manifest parser supports approved words and old symbols', () => {
  assert.deepEqual(parseManifestRequest([]), {
    kind: 'listFirst',
    pageIndex: 0,
  });
  assert.deepEqual(parseManifestRequest(['1', 'SAME', '2']), {
    kind: 'save',
    firstNumber: 1,
    secondNumber: 2,
    relation: 'same',
    symbol: '<3',
  });
  assert.deepEqual(parseManifestRelation('💔'), {
    relation: 'different',
    symbol: '💔',
  });
  assert.equal(parseManifestRequest(['1', 'UNKNOWN', '2']), null);
  assert.equal(parseManifestRequest(['zero', 'SAME', '2']), null);
});

test('independent /manifest lists current constraints and paginated first actions', async () => {
  const { router, saves } = createManifestRouter({
    state: {
      bench: createBench(12),
      manifest: {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Player 1' },
          { identity: 'tele:2', name: 'Player 2' },
        ],
      },
    },
  });

  const firstPage = await router.run(createContext());
  const secondPage = await router.run(createContext(['page', '2']));

  assert.match(firstPage.result.messages[0].text, /Chọn member đầu tiên/);
  assert.match(firstPage.result.messages[0].text, /1\. Player 1 <3 Player 2/);
  assert.match(firstPage.result.messages[0].text, /Trang 1\/2/);
  assert.equal(firstPage.result.messages[0].actions.length, 11);
  assert.deepEqual(firstPage.result.messages[0].actions[0], {
    id: 'manifest_first_1',
    label: '1. Player 1',
    command: '/manifest 1',
  });
  assert.equal(secondPage.result.messages[0].actions[0].label, '11. Player 11');
  assert.equal(secondPage.result.messages[0].actions.at(-1).label, '< Trước');
  assert.equal(saves.length, 0);
});

test('independent /manifest provides relation and second-member actions', async () => {
  const { router, saves } = createManifestRouter({
    state: { bench: createBench(3), manifest: null },
  });

  const relation = await router.run(createContext(['1']));
  const second = await router.run(createContext(['1', 'SAME']));

  assert.equal(relation.result.messages[0].text, 'Chọn quan hệ cho Player 1:');
  assert.deepEqual(relation.result.messages[0].actions, [
    {
      id: 'manifest_same_1',
      label: 'Cùng team <3',
      command: '/manifest 1 SAME',
    },
    {
      id: 'manifest_different_1',
      label: 'Khác team </3',
      command: '/manifest 1 DIFFERENT',
    },
  ]);
  assert.match(second.result.messages[0].text, /Player 1 <3/);
  assert.deepEqual(
    second.result.messages[0].actions.map(action => action.command),
    ['/manifest 1 SAME 2', '/manifest 1 SAME 3']
  );
  assert.equal(saves.length, 0);
});

test('independent /manifest saves stable identities without changing bench', async () => {
  const bench = [
    [1, { name: 'Alice', userId: 1 }],
    ['legacy', 'Guest'],
  ];
  const originalBench = structuredClone(bench);
  const { router, saves } = createManifestRouter({
    state: { bench, manifest: null },
  });

  const routed = await router.run(createContext(['1', 'SAME', '2']));

  assert.deepEqual(bench, originalBench);
  assert.deepEqual(saves, [
    {
      manifest: [
        {
          relation: 'same',
          players: [
            { identity: 'tele:1', name: 'Alice' },
            { identity: 'name:guest', name: 'Guest' },
          ],
        },
      ],
    },
  ]);
  assert.equal(
    routed.result.messages[0].text,
    '🧞‍♂️ Đã nhận nguyện vọng: Alice <3 Guest'
  );
});

test('independent /manifest replaces an existing pair atomically', async () => {
  const state = {
    bench: createBench(2),
    manifest: [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Old 1' },
          { identity: 'tele:2', name: 'Old 2' },
        ],
      },
    ],
  };
  const { router, saves } = createManifestRouter({ state });

  const routed = await router.run(createContext(['2', 'DIFFERENT', '1']));

  assert.equal(saves.length, 1);
  assert.equal(saves[0].manifest.length, 1);
  assert.equal(saves[0].manifest[0].relation, 'different');
  assert.deepEqual(
    saves[0].manifest[0].players.map(player => player.name),
    ['Player 2', 'Player 1']
  );
  assert.match(routed.result.messages[0].text, /Đã cập nhật nguyện vọng/);
});

test('independent /manifest accepts emoji input and rejects contradictions', async () => {
  const state = {
    bench: createBench(3),
    manifest: [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Player 1' },
          { identity: 'tele:2', name: 'Player 2' },
        ],
      },
      {
        relation: 'same',
        players: [
          { identity: 'tele:2', name: 'Player 2' },
          { identity: 'tele:3', name: 'Player 3' },
        ],
      },
    ],
  };
  const { router, saves } = createManifestRouter({ state });

  const conflict = await router.run(createContext(['1', '💔', '3']));

  assert.equal(conflict.result.messages[0].text, MANIFEST_MESSAGES.conflict);
  assert.equal(saves.length, 0);

  const valid = createManifestRouter({
    state: { bench: createBench(2), manifest: null },
  });
  const validResult = await valid.router.run(createContext(['1', '💔', '2']));

  assert.equal(valid.saves[0].manifest[0].relation, 'different');
  assert.match(validResult.result.messages[0].text, /Player 1 💔 Player 2/);
});

test('independent /manifest validates member count and selections', async () => {
  const empty = createManifestRouter({
    state: {
      bench: [],
      manifest: {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Alice' },
          { identity: 'tele:2', name: 'Bob' },
        ],
      },
    },
  });
  const oneMember = createManifestRouter({
    state: { bench: createBench(1), manifest: null },
  });
  const invalid = createManifestRouter({
    state: { bench: createBench(2), manifest: null },
  });

  const emptyResult = await empty.router.run(createContext());
  const oneResult = await oneMember.router.run(createContext());
  const sameResult = await invalid.router.run(
    createContext(['1', 'SAME', '1'])
  );
  const rangeResult = await invalid.router.run(
    createContext(['1', 'SAME', '3'])
  );

  assert.match(emptyResult.result.messages[0].text, /Bench trống/);
  assert.match(emptyResult.result.messages[0].text, /Alice <3 Bob/);
  assert.equal(oneResult.result.messages[0].text, MANIFEST_MESSAGES.notEnough);
  assert.equal(
    sameResult.result.messages[0].text,
    MANIFEST_MESSAGES.invalidSelection
  );
  assert.equal(
    rangeResult.result.messages[0].text,
    MANIFEST_MESSAGES.invalidSelection
  );
  assert.equal(invalid.saves.length, 0);
});

test('independent /manifest handles invalid state and repository failures', async () => {
  const invalid = createManifestRouter({
    state: { bench: createBench(2), manifest: { relation: 'same' } },
  });
  const loadFailure = createManifestRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createManifestRouter({
    state: { bench: createBench(2), manifest: null },
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(
    createContext(['1', 'SAME', '2'])
  );

  assert.equal(
    invalidResult.result.messages[0].text,
    MANIFEST_MESSAGES.loadError
  );
  assert.equal(loadResult.result.messages[0].text, MANIFEST_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, MANIFEST_MESSAGES.saveError);
  assert.equal(invalid.saves.length, 0);
  assert.equal(loadFailure.saves.length, 0);
  assert.equal(saveFailure.saves.length, 0);
});

test('independent /manifest blocks non-admin actors before state load', async () => {
  const { router, saves, getLoadCount } = createManifestRouter({
    state: { bench: createBench(2), manifest: null },
    isAdmin: false,
  });

  const routed = await router.run(createContext(['1', 'SAME', '2'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    MANIFEST_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});
