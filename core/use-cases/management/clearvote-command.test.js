const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const {
  createAttendanceVoteController,
} = require('../../ports/attendance-vote-controller');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  CLEARVOTE_MESSAGES,
  createClearvoteCommand,
  parseClearvoteRequest,
} = require('./clearvote-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'clearvote',
    args,
    actor: {
      platform: 'telegram',
      externalId: actorId,
      displayName: 'Nghia',
    },
    conversation: { externalId: '456', threadId: null },
  };
}

function createClearvoteRouter({
  state = {
    activeVote: {
      id: 'poll-1',
      platform: 'telegram',
      chatId: '-100999',
      messageId: 77,
    },
  },
  isAdmin = true,
  closeError,
  closed = true,
  loadError,
  saveError,
} = {}) {
  const closes = [];
  const saves = [];
  let loadCount = 0;
  const voteController = createAttendanceVoteController({
    async close(reference, context) {
      closes.push({ reference, context });
      if (closeError) throw closeError;
      return { closed };
    },
  });
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createClearvoteCommand({ voteController }),
    ]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['activeVote']);
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

  return { router, closes, saves, state, getLoadCount: () => loadCount };
}

test('shared /clearvote parser supports confirmation and cancel', () => {
  assert.deepEqual(parseClearvoteRequest([]), { kind: 'confirm' });
  assert.deepEqual(parseClearvoteRequest(['CONFIRM']), { kind: 'clear' });
  assert.deepEqual(parseClearvoteRequest(['cancel']), { kind: 'cancel' });
  assert.equal(parseClearvoteRequest(['now']), null);
});

test('independent /clearvote asks before closing or saving', async () => {
  const { router, closes, saves } = createClearvoteRouter();

  const routed = await router.run(createContext());

  assert.equal(routed.result.messages[0].text, CLEARVOTE_MESSAGES.confirmation);
  assert.equal(routed.result.messages[0].actions.length, 2);
  assert.equal(closes.length, 0);
  assert.equal(saves.length, 0);
});

test('independent /clearvote closes and clears the active vote', async () => {
  const { router, closes, saves, state } = createClearvoteRouter();

  const routed = await router.run(createContext(['confirm']));

  assert.equal(closes.length, 1);
  assert.deepEqual(saves, [{ activeVote: null }]);
  assert.equal(state.activeVote, null);
  assert.equal(routed.result.messages[0].text, CLEARVOTE_MESSAGES.success);
});

test('independent /clearvote clears state when platform close fails', async () => {
  const { router, saves } = createClearvoteRouter({
    closeError: new Error('Telegram unavailable'),
  });

  const routed = await router.run(createContext(['confirm']));

  assert.deepEqual(saves, [{ activeVote: null }]);
  assert.equal(routed.result.messages[0].text, CLEARVOTE_MESSAGES.closeFailed);
});

test('independent /clearvote handles cancel, empty state, and invalid input', async () => {
  const current = createClearvoteRouter();
  const empty = createClearvoteRouter({ state: { activeVote: null } });

  const cancelResult = await current.router.run(createContext(['cancel']));
  const emptyResult = await empty.router.run(createContext(['confirm']));
  const invalidResult = await current.router.run(createContext(['now']));

  assert.equal(
    cancelResult.result.messages[0].text,
    CLEARVOTE_MESSAGES.cancelled
  );
  assert.equal(emptyResult.result.messages[0].text, CLEARVOTE_MESSAGES.noVote);
  assert.equal(invalidResult.result.messages[0].text, CLEARVOTE_MESSAGES.usage);
  assert.equal(current.saves.length, 0);
  assert.equal(empty.saves.length, 0);
});

test('independent /clearvote enforces permission and reports storage errors', async () => {
  const denied = createClearvoteRouter({ isAdmin: false });
  const loadFailure = createClearvoteRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createClearvoteRouter({
    saveError: new Error('API unavailable'),
  });

  const deniedResult = await denied.router.run(createContext([], '999'));
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext(['confirm']));

  assert.equal(
    deniedResult.result.messages[0].text,
    CLEARVOTE_MESSAGES.permissionDenied
  );
  assert.equal(denied.getLoadCount(), 0);
  assert.equal(
    loadResult.result.messages[0].text,
    CLEARVOTE_MESSAGES.loadError
  );
  assert.equal(
    saveResult.result.messages[0].text,
    CLEARVOTE_MESSAGES.saveError
  );
});
