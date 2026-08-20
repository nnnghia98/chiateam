const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  TIENSAN_MESSAGES,
  createTiensanCommand,
  parseTiensanRequest,
} = require('./tiensan-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'tiensan',
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

function createTiensanRouter({
  state = { tiensan: 0 },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createTiensanCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['tiensan']);
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

test('shared /tiensan parser accepts valid integer money formats', () => {
  assert.deepEqual(parseTiensanRequest([]), { kind: 'read' });
  assert.deepEqual(parseTiensanRequest(['500000']), {
    kind: 'write',
    amount: 500000,
  });
  assert.deepEqual(parseTiensanRequest(['500.000']), {
    kind: 'write',
    amount: 500000,
  });
  assert.deepEqual(parseTiensanRequest(['1,000,000']), {
    kind: 'write',
    amount: 1000000,
  });
  assert.deepEqual(parseTiensanRequest(['1', '000', '000']), {
    kind: 'write',
    amount: 1000000,
  });
  assert.deepEqual(parseTiensanRequest(['0']), {
    kind: 'write',
    amount: 0,
  });
});

test('shared /tiensan parser rejects changed or unsafe values', () => {
  assert.equal(parseTiensanRequest(['500k']), null);
  assert.equal(parseTiensanRequest(['VND', '500000']), null);
  assert.equal(parseTiensanRequest(['-1']), null);
  assert.equal(parseTiensanRequest(['500.5']), null);
  assert.equal(parseTiensanRequest(['1.000,000']), null);
  assert.equal(parseTiensanRequest(['9007199254740992']), null);
});

test('independent /tiensan reports missing and current fees to players', async () => {
  const missing = createTiensanRouter({ isAdmin: false });
  const current = createTiensanRouter({
    state: { tiensan: 500000 },
    isAdmin: false,
  });

  const missingResult = await missing.router.run(createContext([], '999'));
  const currentResult = await current.router.run(createContext([], '999'));

  assert.equal(missingResult.result.messages[0].text, TIENSAN_MESSAGES.empty);
  assert.equal(
    currentResult.result.messages[0].text,
    '💰 Tiền sân hiện tại: 500.000 VND'
  );
  assert.equal(missingResult.result.messages[0].channel, 'default');
  assert.equal(currentResult.result.messages[0].channel, 'default');
  assert.equal(missing.saves.length, 0);
  assert.equal(current.saves.length, 0);
});

test('independent /tiensan lets an admin save a grouped amount atomically', async () => {
  const { router, saves, state } = createTiensanRouter();

  const routed = await router.run(createContext(['500,000']));

  assert.deepEqual(saves, [{ tiensan: 500000 }]);
  assert.equal(state.tiensan, 500000);
  assert.equal(
    routed.result.messages[0].text,
    '✅ Đã cập nhật tiền sân: 500.000 VND'
  );
  assert.equal(routed.result.messages[0].channel, 'announcement');
});

test('independent /tiensan denies player writes before loading state', async () => {
  const { router, saves, getLoadCount } = createTiensanRouter({
    isAdmin: false,
  });

  const routed = await router.run(createContext(['500000'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    TIENSAN_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /tiensan rejects invalid values without saving', async () => {
  const { router, saves, state } = createTiensanRouter({
    state: { tiensan: 300000 },
  });

  const routed = await router.run(createContext(['500k']));

  assert.equal(routed.result.messages[0].text, TIENSAN_MESSAGES.invalid);
  assert.equal(state.tiensan, 300000);
  assert.equal(saves.length, 0);
});

test('independent /tiensan handles invalid state and repository failures', async () => {
  const invalid = createTiensanRouter({ state: { tiensan: -1 } });
  const loadFailure = createTiensanRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createTiensanRouter({
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['500000']));

  assert.equal(
    invalidResult.result.messages[0].text,
    TIENSAN_MESSAGES.loadError
  );
  assert.equal(loadResult.result.messages[0].text, TIENSAN_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, TIENSAN_MESSAGES.saveError);
});
