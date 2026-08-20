const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const { ADD_MESSAGES, createAddCommand } = require('./add-command');

function createContext(args = []) {
  return {
    command: 'add',
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

function createAddRouter({
  bench = [],
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const state = { bench };
  const saves = [];
  let loadCount = 0;
  let guestNumber = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createAddCommand({
        createGuestId: () => `guest:${++guestNumber}`,
      }),
    ]),
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

test('independent /add atomically adds valid guests and skips duplicates', async () => {
  const originalBench = [[1, { name: 'Minh (@minh)', userId: 1 }]];
  const loadedBench = structuredClone(originalBench);
  const { router, saves } = createAddRouter({ bench: loadedBench });

  const routed = await router.run(
    createContext(['Alice,', 'minh,', 'Bob', '1,', 'ALICE'])
  );

  assert.deepEqual(saves, [
    {
      bench: [
        [1, { name: 'Minh (@minh)', userId: 1 }],
        ['guest:1', { name: 'Alice', memberId: 'guest:1' }],
        ['guest:2', { name: 'Bob 1', memberId: 'guest:2' }],
      ],
    },
  ]);
  assert.deepEqual(loadedBench, originalBench);
  assert.equal(
    routed.result.messages[0].text,
    '✅ Đã thêm 2 member(s) vào /bench:\n' +
      'Alice\n' +
      'Bob 1\n\n' +
      '⏭️ Đã bỏ qua 2 tên đã có:\n' +
      'minh\n' +
      'ALICE'
  );
  assert.equal(routed.result.messages[0].channel, 'default');
});

test('independent /add rejects the full batch when one name is invalid', async () => {
  const bench = [[1, { name: 'Existing' }]];
  const originalBench = structuredClone(bench);
  const { router, saves } = createAddRouter({ bench });

  const routed = await router.run(createContext(['Valid,', 'Bad_name']));

  assert.equal(
    routed.result.messages[0].text,
    '⚠️ Không thêm member nào. Tên không hợp lệ: Bad_name'
  );
  assert.equal(saves.length, 0);
  assert.deepEqual(bench, originalBench);
});

test('independent /add handles missing names and an all-duplicate batch', async () => {
  const missingNames = createAddRouter();
  const duplicates = createAddRouter({
    bench: [[1, { name: 'Alice' }]],
  });

  const missingResult = await missingNames.router.run(createContext());
  const duplicateResult = await duplicates.router.run(
    createContext(['alice,', 'ALICE'])
  );

  assert.equal(missingResult.result.messages[0].text, ADD_MESSAGES.usage);
  assert.equal(
    duplicateResult.result.messages[0].text,
    '⚠️ Không có member mới được thêm. Đã có trong /bench:\n' +
      'alice\n' +
      'ALICE'
  );
  assert.equal(missingNames.saves.length, 0);
  assert.equal(duplicates.saves.length, 0);
});

test('independent /add rejects non-admin actors before loading state', async () => {
  const { router, saves, getLoadCount } = createAddRouter({ isAdmin: false });

  const routed = await router.run(createContext(['Alice']));

  assert.equal(routed.result.messages[0].text, ADD_MESSAGES.permissionDenied);
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /add reports invalid state and repository failures', async () => {
  const invalidState = createAddRouter({ bench: null });
  const loadFailure = createAddRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createAddRouter({
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalidState.router.run(createContext(['Alice']));
  const loadResult = await loadFailure.router.run(createContext(['Alice']));
  const saveResult = await saveFailure.router.run(createContext(['Alice']));

  assert.equal(invalidResult.result.messages[0].text, ADD_MESSAGES.loadError);
  assert.equal(loadResult.result.messages[0].text, ADD_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, ADD_MESSAGES.saveError);
});
