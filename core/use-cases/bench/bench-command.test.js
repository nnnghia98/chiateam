const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const { BENCH_MESSAGES, createBenchCommand } = require('./bench-command');

function createContext() {
  return {
    command: 'bench',
    args: [],
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

function createBenchRouter(load) {
  const repository = createStateRepository({
    load,
    async save() {
      throw new Error('/bench must not save state');
    },
  });

  return createCommandRouter({
    registry: createCommandRegistry([createBenchCommand()]),
    stateRepository: repository,
  });
}

test('independent /bench returns its empty state', async () => {
  const router = createBenchRouter(async keys => {
    assert.deepEqual(keys, ['bench']);
    return { bench: [] };
  });

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, BENCH_MESSAGES.empty);
});

test('independent /bench returns a numbered roster without state changes', async () => {
  const bench = [
    [1, { name: 'Nghia', userId: 1 }],
    [2, { name: 'Minh (@minh)', userId: 2 }],
  ];
  const originalBench = structuredClone(bench);
  const router = createBenchRouter(async () => ({ bench }));

  const routed = await router.run(createContext());

  assert.equal(
    routed.result.messages[0].text,
    '👥 Danh sách hiện tại:\n1. Nghia\n2. Minh (@minh)\n\nTổng: 2 player(s)'
  );
  assert.deepEqual(bench, originalBench);
});

test('independent /bench returns its repository error reply', async () => {
  const router = createBenchRouter(async () => {
    throw new Error('API unavailable');
  });

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, BENCH_MESSAGES.loadError);
});

test('independent /bench does not depend on an earlier command', async () => {
  const states = [
    { bench: [[1, { name: 'First request' }]] },
    { bench: [[2, { name: 'Current request' }]] },
  ];
  const router = createBenchRouter(async () => states.shift());

  await router.run(createContext());
  const second = await router.run(createContext());

  assert.match(second.result.messages[0].text, /Current request/);
  assert.doesNotMatch(second.result.messages[0].text, /First request/);
});
