const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  TIENNUOC_MESSAGES,
  createTiennuocCommand,
  parseTiennuocRequest,
} = require('./tiennuoc-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'tiennuoc',
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

function createTiennuocRouter({
  state = { tiennuoc: 0 },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createTiennuocCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['tiennuoc']);
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

test('shared /tiennuoc parser accepts valid integer money formats', () => {
  assert.deepEqual(parseTiennuocRequest([]), { kind: 'read' });
  assert.deepEqual(parseTiennuocRequest(['60000']), {
    kind: 'write',
    amount: 60000,
  });
  assert.deepEqual(parseTiennuocRequest(['60.000']), {
    kind: 'write',
    amount: 60000,
  });
  assert.deepEqual(parseTiennuocRequest(['1,000,000']), {
    kind: 'write',
    amount: 1000000,
  });
  assert.deepEqual(parseTiennuocRequest(['1', '000', '000']), {
    kind: 'write',
    amount: 1000000,
  });
  assert.deepEqual(parseTiennuocRequest(['0']), {
    kind: 'write',
    amount: 0,
  });
});

test('shared /tiennuoc parser rejects changed or unsafe values', () => {
  assert.equal(parseTiennuocRequest(['60k']), null);
  assert.equal(parseTiennuocRequest(['VND', '60000']), null);
  assert.equal(parseTiennuocRequest(['-1']), null);
  assert.equal(parseTiennuocRequest(['60.5']), null);
  assert.equal(parseTiennuocRequest(['1.000,000']), null);
  assert.equal(parseTiennuocRequest(['9007199254740992']), null);
});

test('independent /tiennuoc reports missing and current fees to players', async () => {
  const missing = createTiennuocRouter({ isAdmin: false });
  const current = createTiennuocRouter({
    state: { tiennuoc: 60000 },
    isAdmin: false,
  });

  const missingResult = await missing.router.run(createContext([], '999'));
  const currentResult = await current.router.run(createContext([], '999'));

  assert.equal(missingResult.result.messages[0].text, TIENNUOC_MESSAGES.empty);
  assert.equal(
    currentResult.result.messages[0].text,
    '🧊 Tiền nước hiện tại: 60.000 VND'
  );
  assert.equal(missingResult.result.messages[0].channel, 'default');
  assert.equal(currentResult.result.messages[0].channel, 'default');
  assert.equal(missing.saves.length, 0);
  assert.equal(current.saves.length, 0);
});

test('independent /tiennuoc lets an admin save a grouped amount atomically', async () => {
  const { router, saves, state } = createTiennuocRouter();

  const routed = await router.run(createContext(['60,000']));

  assert.deepEqual(saves, [{ tiennuoc: 60000 }]);
  assert.equal(state.tiennuoc, 60000);
  assert.equal(
    routed.result.messages[0].text,
    '✅ Đã cập nhật tiền nước: 60.000 VND'
  );
  assert.equal(routed.result.messages[0].channel, 'announcement');
});

test('independent /tiennuoc denies player writes before loading state', async () => {
  const { router, saves, getLoadCount } = createTiennuocRouter({
    isAdmin: false,
  });

  const routed = await router.run(createContext(['60000'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    TIENNUOC_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /tiennuoc rejects invalid values without saving', async () => {
  const { router, saves, state } = createTiennuocRouter({
    state: { tiennuoc: 30000 },
  });

  const routed = await router.run(createContext(['60k']));

  assert.equal(routed.result.messages[0].text, TIENNUOC_MESSAGES.invalid);
  assert.equal(state.tiennuoc, 30000);
  assert.equal(saves.length, 0);
});

test('independent /tiennuoc handles invalid state and repository failures', async () => {
  const invalid = createTiennuocRouter({ state: { tiennuoc: -1 } });
  const loadFailure = createTiennuocRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createTiennuocRouter({
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['60000']));

  assert.equal(
    invalidResult.result.messages[0].text,
    TIENNUOC_MESSAGES.loadError
  );
  assert.equal(loadResult.result.messages[0].text, TIENNUOC_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, TIENNUOC_MESSAGES.saveError);
});
