const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const {
  createAttendanceVotePublisher,
} = require('../../ports/attendance-vote-publisher');
const {
  ATTENDANCE_VOTE_OPTIONS,
  TAOVOTE_MESSAGES,
  createTaovoteCommand,
  parseTaovoteRequest,
} = require('./taovote-command');

function createContext(args = [], actorId = '123') {
  return {
    command: 'taovote',
    args,
    actor: {
      platform: 'telegram',
      externalId: actorId,
      displayName: 'Nghia Nguyen',
      username: 'nghia',
    },
    conversation: {
      externalId: '456',
      threadId: null,
    },
  };
}

function createTaovoteRouter({
  state = { activeVote: null },
  isAdmin = true,
  loadError,
  saveError,
  publishError,
} = {}) {
  const saves = [];
  const published = [];
  let loadCount = 0;
  const votePublisher = createAttendanceVotePublisher({
    async publish(vote, context) {
      if (publishError) throw publishError;
      published.push({ vote, context });
      return {
        id: 'poll-123',
        platform: 'telegram',
        chatId: '-100999',
        messageId: 77,
      };
    },
  });
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createTaovoteCommand({
        votePublisher,
        now: () => new Date('2026-08-10T10:00:00.000Z'),
      }),
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

  return {
    router,
    state,
    saves,
    published,
    getLoadCount: () => loadCount,
  };
}

test('shared /taovote parser accepts help and a bounded question', () => {
  assert.deepEqual(parseTaovoteRequest([]), { kind: 'help' });
  assert.deepEqual(parseTaovoteRequest(['Sân', 'A', '20h']), {
    kind: 'create',
    question: 'Sân A 20h',
  });
  assert.equal(parseTaovoteRequest(['']), null);
  assert.equal(parseTaovoteRequest(['x'.repeat(301)]), null);
});

test('independent /taovote shows help without publishing or saving', async () => {
  const { router, published, saves } = createTaovoteRouter({ isAdmin: false });

  const routed = await router.run(createContext([], '999'));

  assert.equal(routed.result.messages[0].text, TAOVOTE_MESSAGES.help);
  assert.equal(published.length, 0);
  assert.equal(saves.length, 0);
});

test('independent /taovote denies player creation before loading state', async () => {
  const { router, published, saves, getLoadCount } = createTaovoteRouter({
    isAdmin: false,
  });

  const routed = await router.run(createContext(['Sân', 'A'], '999'));

  assert.equal(
    routed.result.messages[0].text,
    TAOVOTE_MESSAGES.permissionDenied
  );
  assert.equal(getLoadCount(), 0);
  assert.equal(published.length, 0);
  assert.equal(saves.length, 0);
});

test('independent /taovote refuses to replace an active vote', async () => {
  const { router, published, saves } = createTaovoteRouter({
    state: { activeVote: { id: 'current-poll' } },
  });

  const routed = await router.run(createContext(['Sân', 'A']));

  assert.equal(routed.result.messages[0].text, TAOVOTE_MESSAGES.voteExists);
  assert.equal(published.length, 0);
  assert.equal(saves.length, 0);
});

test('independent /taovote publishes and saves one platform-neutral vote', async () => {
  const { router, state, published, saves } = createTaovoteRouter();

  const routed = await router.run(createContext(['Sân', 'A', '20h']));

  assert.equal(published.length, 1);
  assert.deepEqual(published[0].vote, {
    question: 'Sân A 20h',
    options: ATTENDANCE_VOTE_OPTIONS,
    createdBy: 'Nghia Nguyen',
    createdAt: '2026-08-10T10:00:00.000Z',
  });
  assert.deepEqual(saves, [
    {
      activeVote: {
        id: 'poll-123',
        question: 'Sân A 20h',
        options: ['0', '+1', '+2', '+3', '+4'],
        chatId: '-100999',
        messageId: 77,
        platform: 'telegram',
        createdBy: 'Nghia Nguyen',
        createdAt: '2026-08-10T10:00:00.000Z',
        totalVoters: 0,
        votes: {},
      },
    },
  ]);
  assert.deepEqual(state.activeVote, saves[0].activeVote);
  assert.equal(routed.result.messages[0].text, '✅ Đã tạo vote: Sân A 20h');
});

test('independent /taovote handles invalid state and external failures', async () => {
  const invalidQuestion = createTaovoteRouter();
  const invalidState = createTaovoteRouter({ state: { activeVote: 'bad' } });
  const loadFailure = createTaovoteRouter({
    loadError: new Error('API unavailable'),
  });
  const publishFailure = createTaovoteRouter({
    publishError: new Error('Telegram unavailable'),
  });
  const saveFailure = createTaovoteRouter({
    saveError: new Error('API unavailable'),
  });

  const invalidQuestionResult = await invalidQuestion.router.run(
    createContext(['x'.repeat(301)])
  );
  const invalidStateResult = await invalidState.router.run(
    createContext(['Sân', 'A'])
  );
  const loadResult = await loadFailure.router.run(createContext(['Sân', 'A']));
  const publishResult = await publishFailure.router.run(
    createContext(['Sân', 'A'])
  );
  const saveResult = await saveFailure.router.run(createContext(['Sân', 'A']));

  assert.equal(
    invalidQuestionResult.result.messages[0].text,
    TAOVOTE_MESSAGES.invalid
  );
  assert.equal(
    invalidStateResult.result.messages[0].text,
    TAOVOTE_MESSAGES.loadError
  );
  assert.equal(loadResult.result.messages[0].text, TAOVOTE_MESSAGES.loadError);
  assert.equal(
    publishResult.result.messages[0].text,
    TAOVOTE_MESSAGES.publishError
  );
  assert.equal(saveResult.result.messages[0].text, TAOVOTE_MESSAGES.saveError);
});
