const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const {
  LOSER_MESSAGES,
  createLoserCommand,
  parseLoserRequest,
} = require('./loser-command');

function createContext(args = []) {
  return {
    command: 'loser',
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

function createLoserRouter() {
  let loadCount = 0;
  let saveCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createLoserCommand()]),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return {};
      },
      async save() {
        saveCount += 1;
        return {};
      },
    }),
  });

  return {
    router,
    getLoadCount: () => loadCount,
    getSaveCount: () => saveCount,
  };
}

test('shared /loser parser maps old input to the inverse /winner command', () => {
  assert.deepEqual(parseLoserRequest([]), {
    kind: 'read',
    replacement: '/winner',
  });
  assert.deepEqual(parseLoserRequest(['home']), {
    kind: 'write',
    loser: 'HOME',
    winner: 'AWAY',
  });
  assert.deepEqual(parseLoserRequest(['AWAY']), {
    kind: 'write',
    loser: 'AWAY',
    winner: 'HOME',
  });
  assert.equal(parseLoserRequest(['EXTRA']), null);
});

test('independent /loser returns replacement guidance without state access', async () => {
  const { router, getLoadCount, getSaveCount } = createLoserRouter();

  const readResult = await router.run(createContext());
  const writeResult = await router.run(createContext(['HOME']));

  assert.equal(readResult.result.messages[0].text, LOSER_MESSAGES.read);
  assert.equal(
    writeResult.result.messages[0].text,
    '⚠️ /loser sẽ được bỏ. Lệnh thay thế: /winner AWAY'
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(getSaveCount(), 0);
});

test('independent /loser rejects unsupported replacement input', async () => {
  const { router, getLoadCount, getSaveCount } = createLoserRouter();

  const routed = await router.run(createContext(['EXTRA']));

  assert.equal(routed.result.messages[0].text, LOSER_MESSAGES.usage);
  assert.equal(getLoadCount(), 0);
  assert.equal(getSaveCount(), 0);
});
