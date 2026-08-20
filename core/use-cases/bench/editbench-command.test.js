const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  EDITBENCH_MESSAGES,
  createEditbenchCommand,
} = require('./editbench-command');

function createContext(args = []) {
  return {
    command: 'editbench',
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

function createEditbenchRouter({
  bench = [],
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const state = { bench };
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createEditbenchCommand()]),
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

test('independent /editbench lists members with paginated actions', async () => {
  const bench = Array.from({ length: 12 }, (_, index) => [
    index + 1,
    { name: `Player ${index + 1}`, userId: index + 1 },
  ]);
  const { router, saves } = createEditbenchRouter({ bench });

  const firstPage = await router.run(createContext());
  const secondPage = await router.run(createContext(['page', '2']));

  assert.equal(
    firstPage.result.messages[0].text,
    '📋 Chọn member cần đổi tên:\nTrang 1/2'
  );
  assert.equal(firstPage.result.messages[0].actions.length, 11);
  assert.deepEqual(firstPage.result.messages[0].actions[0], {
    id: 'editbench_select_1',
    label: '1. Player 1',
    command: '/editbench 1',
  });
  assert.deepEqual(firstPage.result.messages[0].actions.at(-1), {
    id: 'editbench_page_2',
    label: 'Tiếp >',
    command: '/editbench page 2',
  });
  assert.equal(secondPage.result.messages[0].actions[0].label, '11. Player 11');
  assert.equal(secondPage.result.messages[0].actions.at(-1).label, '< Trước');
  assert.equal(saves.length, 0);
});

test('independent /editbench requests a follow-up name after selection', async () => {
  const { router, saves } = createEditbenchRouter({
    bench: [
      [1, { name: 'Nghia', userId: 1 }],
      [2, { name: 'Minh', userId: 2 }],
    ],
  });

  const routed = await router.run(createContext(['2']));

  assert.match(routed.result.messages[0].text, /Nhập tên mới cho Minh/);
  assert.match(routed.result.messages[0].text, /\/editbench 2 TÊN_MỚI/);
  assert.deepEqual(routed.result.messages[0].input, {
    command: 'editbench',
    args: ['2'],
  });
  assert.equal(saves.length, 0);
});

test('independent /editbench renames without mutating loaded state', async () => {
  const bench = [
    [1, { name: 'Nghia (@nghia)', userId: 11 }],
    ['guest:1', 'Guest'],
  ];
  const originalBench = structuredClone(bench);
  const { router, saves } = createEditbenchRouter({ bench });

  const memberResult = await router.run(
    createContext(['1', 'Nguyễn', 'Văn', 'A', '2'])
  );

  assert.deepEqual(saves, [
    {
      bench: [
        [1, { name: 'Nguyễn Văn A 2', userId: 11 }],
        ['guest:1', 'Guest'],
      ],
    },
  ]);
  assert.deepEqual(bench, originalBench);
  assert.equal(
    memberResult.result.messages[0].text,
    '✅ Đã đổi tên: Nghia (@nghia) → Nguyễn Văn A 2'
  );

  const guestResult = await router.run(createContext(['2', 'New', 'Guest']));

  assert.deepEqual(saves[1].bench[1], [
    'guest:1',
    { name: 'New Guest', memberId: 'bench:guest:1' },
  ]);
  assert.match(guestResult.result.messages[0].text, /Guest → New Guest/);
});

test('independent /editbench rejects invalid selections, names, and duplicates', async () => {
  const { router, saves } = createEditbenchRouter({
    bench: [
      [1, { name: 'Nghia', userId: 1 }],
      [2, { name: 'Minh (@minh)', userId: 2 }],
    ],
  });

  const invalidSelection = await router.run(createContext(['3', 'New']));
  const invalidName = await router.run(createContext(['1', 'Bad_name']));
  const duplicate = await router.run(createContext(['1', 'MINH']));

  assert.equal(
    invalidSelection.result.messages[0].text,
    EDITBENCH_MESSAGES.invalidSelection
  );
  assert.match(invalidName.result.messages[0].text, /Tên mới không hợp lệ/);
  assert.deepEqual(invalidName.result.messages[0].input.args, ['1']);
  assert.match(duplicate.result.messages[0].text, /MINH đã tồn tại/);
  assert.deepEqual(duplicate.result.messages[0].input.args, ['1']);
  assert.equal(saves.length, 0);
});

test('independent /editbench handles empty, invalid, and failed state', async () => {
  const empty = createEditbenchRouter();
  const invalid = createEditbenchRouter({ bench: [['broken']] });
  const loadFailure = createEditbenchRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createEditbenchRouter({
    bench: [[1, { name: 'Nghia', userId: 1 }]],
    saveError: new Error('API unavailable'),
  });

  const emptyResult = await empty.router.run(createContext());
  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(
    createContext(['1', 'New Name'])
  );

  assert.equal(emptyResult.result.messages[0].text, EDITBENCH_MESSAGES.empty);
  assert.equal(
    invalidResult.result.messages[0].text,
    EDITBENCH_MESSAGES.loadError
  );
  assert.equal(
    loadResult.result.messages[0].text,
    EDITBENCH_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    EDITBENCH_MESSAGES.saveError
  );
});

test('independent /editbench rejects non-admin actors before loading state', async () => {
  const { router, saves, getLoadCount } = createEditbenchRouter({
    isAdmin: false,
  });

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    EDITBENCH_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});
