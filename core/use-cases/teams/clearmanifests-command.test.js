const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CLEARMANIFESTS_MESSAGES,
  createClearmanifestsCommand,
  parseClearmanifestsRequest,
} = require('./clearmanifests-command');

function createManifest() {
  return {
    relation: 'same',
    players: [
      { identity: 'tele:1', name: 'Alice' },
      { identity: 'tele:2', name: 'Bob' },
    ],
  };
}

function createContext(args = [], actorId = '123') {
  return {
    command: 'clearmanifests',
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

function createClearmanifestsRouter({
  state = { manifest: null },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createClearmanifestsCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['manifest']);
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

test('shared /clearmanifests parser supports confirm and cancel', () => {
  assert.deepEqual(parseClearmanifestsRequest([]), { kind: 'confirm' });
  assert.deepEqual(parseClearmanifestsRequest(['CONFIRM']), { kind: 'clear' });
  assert.deepEqual(parseClearmanifestsRequest(['cancel']), { kind: 'cancel' });
  assert.equal(parseClearmanifestsRequest(['now']), null);
  assert.equal(parseClearmanifestsRequest(['confirm', 'now']), null);
});

test('independent /clearmanifests asks before changing state', async () => {
  const manifest = [createManifest()];
  const originalManifest = structuredClone(manifest);
  const { router, saves } = createClearmanifestsRouter({
    state: { manifest },
  });

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.confirmation
  );
  assert.deepEqual(routed.result.messages[0].actions, [
    {
      id: 'clearmanifests_confirm',
      label: '✅ Xác nhận',
      command: '/clearmanifests confirm',
    },
    {
      id: 'clearmanifests_cancel',
      label: 'Hủy',
      command: '/clearmanifests cancel',
    },
  ]);
  assert.deepEqual(manifest, originalManifest);
  assert.equal(saves.length, 0);
});

test('independent /clearmanifests clears all manifests atomically', async () => {
  const { router, saves, state } = createClearmanifestsRouter({
    state: { manifest: [createManifest(), createManifest()] },
  });

  const routed = await router.run(createContext(['confirm']));

  assert.deepEqual(saves, [{ manifest: null }]);
  assert.equal(state.manifest, null);
  assert.equal(routed.result.messages[0].text, CLEARMANIFESTS_MESSAGES.success);
});

test('independent /clearmanifests cancel does not save state', async () => {
  const manifest = [createManifest()];
  const { router, saves, state } = createClearmanifestsRouter({
    state: { manifest },
  });

  const routed = await router.run(createContext(['cancel']));

  assert.equal(
    routed.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.cancelled
  );
  assert.equal(state.manifest, manifest);
  assert.equal(saves.length, 0);
});

test('independent /clearmanifests handles empty and invalid requests', async () => {
  const empty = createClearmanifestsRouter();
  const populated = createClearmanifestsRouter({
    state: { manifest: [createManifest()] },
  });

  const emptyResult = await empty.router.run(createContext());
  const repeatedConfirm = await empty.router.run(createContext(['confirm']));
  const invalidResult = await populated.router.run(createContext(['now']));

  assert.equal(
    emptyResult.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.empty
  );
  assert.equal(
    repeatedConfirm.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.empty
  );
  assert.equal(
    invalidResult.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.usage
  );
  assert.equal(empty.saves.length, 0);
  assert.equal(populated.saves.length, 0);
});

test('independent /clearmanifests can recover non-array manifest state', async () => {
  const { router, saves } = createClearmanifestsRouter({
    state: { manifest: createManifest() },
  });

  const routed = await router.run(createContext(['confirm']));

  assert.deepEqual(saves, [{ manifest: null }]);
  assert.equal(routed.result.messages[0].text, CLEARMANIFESTS_MESSAGES.success);
});

test('independent /clearmanifests denies non-admins before state load', async () => {
  const { router, saves, getLoadCount } = createClearmanifestsRouter({
    state: { manifest: [createManifest()] },
    isAdmin: false,
  });

  const routed = await router.run(createContext([], '999'));

  assert.equal(
    routed.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /clearmanifests reports repository errors', async () => {
  const loadFailure = createClearmanifestsRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createClearmanifestsRouter({
    state: { manifest: [createManifest()] },
    saveError: new Error('API unavailable'),
  });

  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['confirm']));

  assert.equal(
    loadResult.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    CLEARMANIFESTS_MESSAGES.saveError
  );
});
