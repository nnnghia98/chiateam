const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CLEARSAN_MESSAGES,
  createClearsanCommand,
} = require('./clearsan-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'clearsan',
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

function createClearsanRouter({
  state = { san: null },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createClearsanCommand()]),
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

test('independent /clearsan clears the venue atomically', async () => {
  const { router, saves, state } = createClearsanRouter({
    state: { san: 'Sân số 8' },
  });

  const routed = await router.run(createContext());

  assert.deepEqual(saves, [{ san: null }]);
  assert.equal(state.san, null);
  assert.equal(routed.result.messages[0].text, CLEARSAN_MESSAGES.success);
  assert.equal(routed.result.messages[0].channel, 'default');
});

test('independent /clearsan does not save an empty venue', async () => {
  const { router, saves } = createClearsanRouter();

  const first = await router.run(createContext());
  const repeated = await router.run(createContext());

  assert.equal(first.result.messages[0].text, CLEARSAN_MESSAGES.empty);
  assert.equal(repeated.result.messages[0].text, CLEARSAN_MESSAGES.empty);
  assert.equal(saves.length, 0);
});

test('independent /clearsan rejects arguments without saving', async () => {
  const { router, saves, state } = createClearsanRouter({
    state: { san: 'Sân số 8' },
  });

  const routed = await router.run(createContext(['now']));

  assert.equal(routed.result.messages[0].text, CLEARSAN_MESSAGES.usage);
  assert.equal(state.san, 'Sân số 8');
  assert.equal(saves.length, 0);
});

test('independent /clearsan denies non-admins before state load', async () => {
  const { router, saves, getLoadCount } = createClearsanRouter({
    state: { san: 'Sân số 8' },
    isAdmin: false,
  });

  const routed = await router.run(createContext([], '999'));

  assert.equal(
    routed.result.messages[0].text,
    CLEARSAN_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /clearsan handles invalid state and repository failures', async () => {
  const invalid = createClearsanRouter({ state: { san: 123 } });
  const loadFailure = createClearsanRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createClearsanRouter({
    state: { san: 'Sân số 8' },
    saveError: new Error('API unavailable'),
  });

  const invalidResult = await invalid.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext());

  assert.equal(
    invalidResult.result.messages[0].text,
    CLEARSAN_MESSAGES.loadError
  );
  assert.equal(loadResult.result.messages[0].text, CLEARSAN_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, CLEARSAN_MESSAGES.saveError);
});
