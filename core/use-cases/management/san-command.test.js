const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  SAN_MESSAGES,
  createSanCommand,
  parseSanRequest,
} = require('./san-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'san',
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

function createSanRouter({
  state = { san: null },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createSanCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['san']);
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

test('shared /san parser supports reading and multi-word venue names', () => {
  assert.deepEqual(parseSanRequest([]), { kind: 'read' });
  assert.deepEqual(parseSanRequest(['  Sân', ' số ', '8  ']), {
    kind: 'write',
    venue: 'Sân số 8',
  });
  assert.equal(parseSanRequest(['   ']), null);
  assert.equal(parseSanRequest(null), null);
});

test('independent /san reports missing and current venues to players', async () => {
  const missing = createSanRouter({ isAdmin: false });
  const current = createSanRouter({
    state: { san: 'Sân số 8' },
    isAdmin: false,
  });

  const missingResult = await missing.router.run(createContext([], '999'));
  const currentResult = await current.router.run(createContext([], '999'));

  assert.equal(missingResult.result.messages[0].text, SAN_MESSAGES.noSan);
  assert.equal(missingResult.result.messages[0].channel, 'default');
  assert.equal(currentResult.result.messages[0].text, 'Sân: Sân số 8');
  assert.equal(currentResult.result.messages[0].channel, 'announcement');
  assert.equal(missing.saves.length, 0);
  assert.equal(current.saves.length, 0);
});

test('independent /san lets an admin replace the current venue atomically', async () => {
  const { router, saves, state } = createSanRouter({
    state: { san: 'Sân cũ' },
  });

  const routed = await router.run(createContext(['Sân', 'số', '8']));

  assert.deepEqual(saves, [{ san: 'Sân số 8' }]);
  assert.equal(state.san, 'Sân số 8');
  assert.equal(routed.result.messages[0].text, '✅ Đã lưu sân: Sân số 8');
  assert.equal(routed.result.messages[0].channel, 'default');
});

test('independent /san denies player writes before loading state', async () => {
  const { router, saves, getLoadCount } = createSanRouter({
    state: { san: 'Sân cũ' },
    isAdmin: false,
  });

  const routed = await router.run(createContext(['Sân', 'mới'], '999'));

  assert.equal(routed.result.messages[0].text, SAN_MESSAGES.permissionDenied);
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /san handles invalid state and repository failures', async () => {
  const invalid = createSanRouter({ state: { san: 123 } });
  const loadFailure = createSanRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createSanRouter({
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(
    createContext(['Sân', 'mới'])
  );

  assert.equal(invalidResult.result.messages[0].text, SAN_MESSAGES.loadError);
  assert.equal(loadResult.result.messages[0].text, SAN_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, SAN_MESSAGES.saveError);
});
