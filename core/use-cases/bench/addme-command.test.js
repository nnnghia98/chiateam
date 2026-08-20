const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const { ADDME_MESSAGES, createAddmeCommand } = require('./addme-command');

function createContext(overrides = {}) {
  const {
    actor: actorOverrides = {},
    conversation: conversationOverrides = {},
    ...contextOverrides
  } = overrides;

  return {
    command: 'addme',
    args: [],
    ...contextOverrides,
    actor: {
      platform: 'telegram',
      externalId: '123',
      displayName: 'Nghia',
      username: 'nghia',
      ...actorOverrides,
    },
    conversation: {
      externalId: '456',
      threadId: null,
      ...conversationOverrides,
    },
  };
}

function createAddmeRouter({ bench = [], loadError, saveError } = {}) {
  const state = { bench };
  const saves = [];
  const repository = createStateRepository({
    async load(keys) {
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
  });

  return {
    router: createCommandRouter({
      registry: createCommandRegistry([createAddmeCommand()]),
      stateRepository: repository,
    }),
    saves,
    state,
  };
}

test('independent /addme adds the common actor without mutating loaded state', async () => {
  const originalBench = [[1, { name: 'Minh' }]];
  const loadedBench = structuredClone(originalBench);
  const { router, saves } = createAddmeRouter({ bench: loadedBench });

  const routed = await router.run(createContext());

  assert.deepEqual(saves, [
    {
      bench: [
        [1, { name: 'Minh' }],
        [
          'telegram:123',
          {
            name: 'Nghia (@nghia)',
            memberId: 'telegram:123',
            identity: { platform: 'telegram', externalId: '123' },
          },
        ],
      ],
    },
  ]);
  assert.deepEqual(loadedBench, originalBench);
  assert.equal(routed.result.messages[0].text, '✅ Nghia (@nghia) lên bench!');
  assert.equal(routed.result.messages[0].channel, 'main');
});

test('independent /addme rejects duplicate identity and duplicate name', async () => {
  const cases = [
    [
      [
        'telegram:123',
        {
          name: 'Old name',
          identity: { platform: 'telegram', externalId: '123' },
        },
      ],
    ],
    [[999, { name: 'nGhIa (@other)', userId: 999 }]],
  ];

  for (const bench of cases) {
    const { router, saves } = createAddmeRouter({ bench });
    const routed = await router.run(createContext());

    assert.equal(
      routed.result.messages[0].text,
      '⚠️ Đã có tên Nghia trong bench.'
    );
    assert.equal(routed.result.messages[0].channel, 'default');
    assert.equal(saves.length, 0);
  }
});

test('independent /addme validates arguments, actor name, and bench state', async () => {
  const cases = [
    {
      context: createContext({ args: ['extra'] }),
      state: {},
      expected: ADDME_MESSAGES.usage,
    },
    {
      context: createContext({ actor: { displayName: 'Bad_name' } }),
      state: {},
      expected: ADDME_MESSAGES.invalidName,
    },
    {
      context: createContext(),
      state: { bench: null },
      expected: ADDME_MESSAGES.loadError,
    },
  ];

  for (const currentCase of cases) {
    const { router, saves } = createAddmeRouter(currentCase.state);
    const routed = await router.run(currentCase.context);

    assert.equal(routed.result.messages[0].text, currentCase.expected);
    assert.equal(saves.length, 0);
  }
});

test('independent /addme reports repository load and save failures', async () => {
  const loadFailure = createAddmeRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createAddmeRouter({
    saveError: new Error('API unavailable'),
  });

  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext());

  assert.equal(loadResult.result.messages[0].text, ADDME_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, ADDME_MESSAGES.saveError);
});
