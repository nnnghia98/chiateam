const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const {
  MANIFESTS_MESSAGES,
  createManifestsCommand,
} = require('./manifests-command');

function createContext(command = 'manifests', args = []) {
  return {
    command,
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

function createManifestsRouter(load) {
  return createCommandRouter({
    registry: createCommandRegistry([createManifestsCommand()]),
    stateRepository: createStateRepository({
      load,
      async save() {
        throw new Error('/manifests must not save state');
      },
    }),
  });
}

test('independent /manifests returns its empty state', async () => {
  const router = createManifestsRouter(async keys => {
    assert.deepEqual(keys, ['manifest']);
    return { manifest: null };
  });

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, MANIFESTS_MESSAGES.empty);
});

test('independent /manifests lists same-team and different-team constraints', async () => {
  const manifest = [
    {
      relation: 'same',
      players: [{ name: 'Alice' }, { name: 'Bob' }],
    },
    {
      relation: 'different',
      players: [{ name: 'Carol_name' }, { name: 'Dan *D*' }],
    },
  ];
  const originalManifest = structuredClone(manifest);
  const router = createManifestsRouter(async () => ({ manifest }));

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    '📋 Danh sách manifest:\n\n' +
      '1. Alice <3 Bob\n' +
      '2. Carol_name </3 Dan *D*'
  );
  assert.deepEqual(manifest, originalManifest);
});

test('independent /mf shows a deprecation notice and the useful result', async () => {
  const router = createManifestsRouter(async () => ({
    manifest: {
      relation: 'same',
      players: [{ name: 'Alice' }, { name: 'Bob' }],
    },
  }));

  const routed = await router.run(createContext('mf'));

  assert.match(routed.result.messages[0].text, /\/mf sẽ được thay thế/);
  assert.match(routed.result.messages[0].text, /1\. Alice <3 Bob/);
});

test('independent /manifests rejects arguments and invalid stored state', async () => {
  const validRouter = createManifestsRouter(async () => ({ manifest: null }));
  const invalidStateRouter = createManifestsRouter(async () => ({
    manifest: { relation: 'same', players: [{ name: 'Only one' }] },
  }));

  const invalidArguments = await validRouter.run(
    createContext('manifests', ['x'])
  );
  const invalidState = await invalidStateRouter.run(createContext());

  assert.equal(
    invalidArguments.result.messages[0].text,
    MANIFESTS_MESSAGES.usage
  );
  assert.equal(
    invalidState.result.messages[0].text,
    MANIFESTS_MESSAGES.loadError
  );
});

test('independent /manifests returns its repository error reply', async () => {
  const router = createManifestsRouter(async () => {
    throw new Error('API unavailable');
  });

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, MANIFESTS_MESSAGES.loadError);
});
