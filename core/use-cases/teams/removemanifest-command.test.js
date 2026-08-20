const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  REMOVEMANIFEST_MESSAGES,
  createManifestToken,
  createRemovemanifestCommand,
  parseRemovemanifestRequest,
} = require('./removemanifest-command');

function createManifest(index) {
  return {
    relation: index % 2 === 0 ? 'same' : 'different',
    players: [
      { identity: `tele:${index * 2 + 1}`, name: `Player ${index * 2 + 1}` },
      { identity: `tele:${index * 2 + 2}`, name: `Player ${index * 2 + 2}` },
    ],
  };
}

function createContext(args = [], actorId = '123') {
  return {
    command: 'removemanifest',
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

function createRemovemanifestRouter({
  state = { manifest: null },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createRemovemanifestCommand()]),
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

test('shared /removemanifest parser supports list, page, and number requests', () => {
  assert.deepEqual(parseRemovemanifestRequest([]), {
    kind: 'list',
    pageIndex: 0,
  });
  assert.deepEqual(parseRemovemanifestRequest(['page', '2']), {
    kind: 'list',
    pageIndex: 1,
  });
  assert.deepEqual(parseRemovemanifestRequest(['3']), {
    kind: 'remove',
    manifestNumber: 3,
  });
  const token = createManifestToken(createManifest(0));
  assert.deepEqual(parseRemovemanifestRequest(['token', token]), {
    kind: 'removeToken',
    token,
  });
  assert.equal(parseRemovemanifestRequest(['zero']), null);
  assert.equal(parseRemovemanifestRequest(['1', '2']), null);
});

test('independent /removemanifest lists paginated fallback actions', async () => {
  const manifest = Array.from({ length: 12 }, (_, index) =>
    createManifest(index)
  );
  const originalManifest = structuredClone(manifest);
  const { router, saves } = createRemovemanifestRouter({
    state: { manifest },
  });

  const firstPage = await router.run(createContext());
  const secondPage = await router.run(createContext(['page', '2']));

  assert.equal(
    firstPage.result.messages[0].text,
    '📋 Chọn manifest cần xóa:\nTrang 1/2'
  );
  assert.equal(firstPage.result.messages[0].actions.length, 11);
  assert.deepEqual(firstPage.result.messages[0].actions[0], {
    id: `removemanifest_remove_${createManifestToken(manifest[0])}`,
    label: '1. Player 1 <3 Player 2',
    command: `/removemanifest token ${createManifestToken(manifest[0])}`,
  });
  assert.equal(
    firstPage.result.messages[0].actions.at(-1).command,
    '/removemanifest page 2'
  );
  assert.equal(
    secondPage.result.messages[0].actions[0].label,
    '11. Player 21 <3 Player 22'
  );
  assert.equal(
    secondPage.result.messages[0].actions.at(-1).command,
    '/removemanifest page 1'
  );
  assert.deepEqual(manifest, originalManifest);
  assert.equal(saves.length, 0);
});

test('independent /removemanifest removes one item and preserves identities', async () => {
  const first = createManifest(0);
  const second = createManifest(1);
  const { router, saves, state } = createRemovemanifestRouter({
    state: { manifest: [first, second] },
  });

  const routed = await router.run(createContext(['1']));

  assert.deepEqual(saves, [{ manifest: [second] }]);
  assert.deepEqual(state.manifest, [second]);
  assert.equal(
    routed.result.messages[0].text,
    '✅ Đã xóa manifest: Player 1 <3 Player 2'
  );
});

test('independent /removemanifest saves null after removing the last item', async () => {
  const { router, saves } = createRemovemanifestRouter({
    state: { manifest: createManifest(0) },
  });

  await router.run(createContext(['1']));

  assert.deepEqual(saves, [{ manifest: null }]);
});

test('independent /removemanifest rejects a stale button token', async () => {
  const removed = createManifest(0);
  const remaining = createManifest(1);
  const { router, saves } = createRemovemanifestRouter({
    state: { manifest: [remaining] },
  });

  const routed = await router.run(
    createContext(['token', createManifestToken(removed)])
  );

  assert.equal(
    routed.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.staleSelection
  );
  assert.equal(saves.length, 0);
});

test('independent /removemanifest handles empty, invalid, and malformed states', async () => {
  const empty = createRemovemanifestRouter();
  const populated = createRemovemanifestRouter({
    state: { manifest: [createManifest(0)] },
  });
  const malformed = createRemovemanifestRouter({
    state: { manifest: { relation: 'same', players: [{ name: 'Only one' }] } },
  });

  const emptyResult = await empty.router.run(createContext());
  const invalidNumber = await populated.router.run(createContext(['2']));
  const invalidText = await populated.router.run(createContext(['nope']));
  const malformedResult = await malformed.router.run(createContext());

  assert.equal(
    emptyResult.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.empty
  );
  assert.equal(
    invalidNumber.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.invalidSelection
  );
  assert.equal(
    invalidText.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.invalidSelection
  );
  assert.equal(
    malformedResult.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.loadError
  );
});

test('independent /removemanifest denies non-admins before loading state', async () => {
  const { router, saves, getLoadCount } = createRemovemanifestRouter({
    state: { manifest: [createManifest(0)] },
    isAdmin: false,
  });

  const routed = await router.run(createContext([], '999'));

  assert.equal(
    routed.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(saves.length, 0);
});

test('independent /removemanifest reports repository load and save errors', async () => {
  const loadFailure = createRemovemanifestRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createRemovemanifestRouter({
    state: { manifest: [createManifest(0)] },
    saveError: new Error('API unavailable'),
  });

  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['1']));

  assert.equal(
    loadResult.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    REMOVEMANIFEST_MESSAGES.saveError
  );
});
