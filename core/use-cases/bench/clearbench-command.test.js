const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CLEARBENCH_MESSAGES,
  createClearbenchCommand,
  parseClearbenchSelection,
} = require('./clearbench-command');

function createContext(args = []) {
  return {
    command: 'clearbench',
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

function createClearbenchRouter({
  bench = [],
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const state = { bench };
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createClearbenchCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['bench']);
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

test('independent /clearbench lists paginated remove actions', async () => {
  const bench = Array.from({ length: 12 }, (_, index) => [
    index + 1,
    { name: `Player ${index + 1}`, userId: index + 1 },
  ]);
  const { router, saves } = createClearbenchRouter({ bench });

  const firstPage = await router.run(createContext());
  const secondPage = await router.run(createContext(['page', '2']));

  assert.equal(
    firstPage.result.messages[0].text,
    '📋 Chọn member cần xóa khỏi bench:\nTrang 1/2'
  );
  assert.deepEqual(firstPage.result.messages[0].actions[0], {
    id: 'clearbench_remove_1',
    label: '1. Player 1',
    command: '/clearbench 1',
  });
  assert.deepEqual(firstPage.result.messages[0].actions.at(-2), {
    id: 'clearbench_page_2',
    label: 'Tiếp ➡️',
    command: '/clearbench page 2',
  });
  assert.equal(
    firstPage.result.messages[0].actions.at(-1).command,
    '/clearbench all'
  );
  assert.equal(secondPage.result.messages[0].actions[0].label, '11. Player 11');
  assert.equal(secondPage.result.messages[0].actions.at(-2).label, '⬅️ Trước');
  assert.equal(saves.length, 0);
});

test('clearbench selection parser is strict and removes duplicates', () => {
  assert.deepEqual(parseClearbenchSelection('1, 3-5, 3', 5), [0, 2, 3, 4]);
  assert.equal(parseClearbenchSelection('1,broken', 5), null);
  assert.equal(parseClearbenchSelection('3-2', 5), null);
  assert.equal(parseClearbenchSelection('1,6', 5), null);
  assert.equal(parseClearbenchSelection('1,,2', 5), null);
  assert.equal(parseClearbenchSelection('1abc', 5), null);
});

test('independent /clearbench atomically removes numbers and ranges', async () => {
  const bench = [
    [1, { name: 'Alice', userId: 1 }],
    [2, { name: 'Bob', userId: 2 }],
    ['guest:1', { name: 'Carol', memberId: 'guest:1' }],
    ['guest:2', 'Dan'],
  ];
  const originalBench = structuredClone(bench);
  const { router, saves } = createClearbenchRouter({ bench });

  const routed = await router.run(createContext(['1,', '3-4']));

  assert.deepEqual(saves, [{ bench: [[2, { name: 'Bob', userId: 2 }]] }]);
  assert.deepEqual(bench, originalBench);
  assert.equal(
    routed.result.messages[0].text,
    '✅ Đã xóa 3 member(s):\nAlice\nCarol\nDan'
  );
});

test('independent /clearbench returns the single-member result', async () => {
  const { router, saves } = createClearbenchRouter({
    bench: [
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ],
  });

  const routed = await router.run(createContext(['2']));

  assert.deepEqual(saves, [{ bench: [[1, { name: 'Alice', userId: 1 }]] }]);
  assert.equal(routed.result.messages[0].text, '✅ Đã xóa Bob khỏi bench.');
});

test('independent /clearbench all clears the bench immediately', async () => {
  const { router, saves, state } = createClearbenchRouter({
    bench: [
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ],
  });

  const cleared = await router.run(createContext(['all']));

  assert.equal(
    cleared.result.messages[0].text,
    CLEARBENCH_MESSAGES.clearAllSuccess
  );
  assert.deepEqual(saves, [{ bench: [] }]);
  assert.deepEqual(state.bench, []);
});

test('independent /clearbench rejects invalid input without partial removal', async () => {
  const bench = [
    [1, { name: 'Alice', userId: 1 }],
    [2, { name: 'Bob', userId: 2 }],
  ];
  const originalBench = structuredClone(bench);
  const { router, saves } = createClearbenchRouter({ bench });

  const routed = await router.run(createContext(['1,', 'missing']));
  const removedConfirmation = await router.run(
    createContext(['confirm', 'all'])
  );

  assert.equal(
    routed.result.messages[0].text,
    CLEARBENCH_MESSAGES.invalidSelection
  );
  assert.equal(saves.length, 0);
  assert.deepEqual(bench, originalBench);
  assert.equal(
    removedConfirmation.result.messages[0].text,
    CLEARBENCH_MESSAGES.invalidSelection
  );
});

test('independent /clearbench handles permission and repository failures', async () => {
  const denied = createClearbenchRouter({ isAdmin: false });
  const invalid = createClearbenchRouter({ bench: [['broken']] });
  const loadFailure = createClearbenchRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createClearbenchRouter({
    bench: [[1, { name: 'Alice', userId: 1 }]],
    saveError: new Error('API unavailable'),
  });

  const deniedResult = await denied.router.run(createContext());
  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['1']));

  assert.equal(
    deniedResult.result.messages[0].text,
    CLEARBENCH_MESSAGES.permissionDenied
  );
  assert.equal(denied.getLoadCount(), 0);
  assert.equal(
    invalidResult.result.messages[0].text,
    CLEARBENCH_MESSAGES.loadError
  );
  assert.equal(
    loadResult.result.messages[0].text,
    CLEARBENCH_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    CLEARBENCH_MESSAGES.saveError
  );
});

test('independent /clearbench returns the empty state', async () => {
  const { router, saves } = createClearbenchRouter();

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, CLEARBENCH_MESSAGES.empty);
  assert.equal(saves.length, 0);
});
