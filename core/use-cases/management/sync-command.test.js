const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStateRepository } = require('../../ports/state-repository');
const { ATTENDANCE_VOTE_OPTIONS } = require('./attendance-vote');
const {
  SYNC_MESSAGES,
  createSyncCommand,
  syncVoteToBench,
} = require('./sync-command');

function createVote() {
  return {
    id: 'poll-1',
    platform: 'telegram',
    question: 'Sân A 20h',
    options: ATTENDANCE_VOTE_OPTIONS,
    votes: {
      1: { id: 1, name: 'Alice', options: [2] },
      2: { id: 2, name: 'Bob', choice: '+3' },
      3: { id: 3, name: 'Carol', choice: '0' },
      4: { id: 4, name: 'Dan', options: [] },
    },
  };
}

function createContext(args = [], actorId = '123') {
  return {
    command: 'sync',
    args,
    actor: {
      platform: 'telegram',
      externalId: actorId,
      displayName: 'Nghia',
    },
    conversation: { externalId: '456', threadId: null },
  };
}

function createSyncRouter({
  state = { activeVote: createVote(), bench: [] },
  isAdmin = true,
  loadError,
  saveError,
} = {}) {
  const saves = [];
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createSyncCommand()]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load(keys) {
        loadCount += 1;
        assert.deepEqual(keys, ['activeVote', 'bench']);
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

test('vote sync creates stable voter and guest identities', () => {
  const result = syncVoteToBench(createVote(), [
    [1, { name: 'Alice', userId: 1 }],
  ]);

  assert.equal(result.totalVoters, 2);
  assert.deepEqual(result.addedNames, ['Alice 1', 'Bob', 'Bob 1', 'Bob 2']);
  assert.deepEqual(result.skippedNames, ['Alice']);
  assert.deepEqual(result.bench.slice(1), [
    [
      'vote-guest:telegram:1:1',
      { name: 'Alice 1', memberId: 'vote-guest:telegram:1:1' },
    ],
    [
      2,
      {
        name: 'Bob',
        userId: 2,
        identity: { platform: 'telegram', externalId: '2' },
      },
    ],
    [
      'vote-guest:telegram:2:1',
      { name: 'Bob 1', memberId: 'vote-guest:telegram:2:1' },
    ],
    [
      'vote-guest:telegram:2:2',
      { name: 'Bob 2', memberId: 'vote-guest:telegram:2:2' },
    ],
  ]);
});

test('vote sync keeps Zalo identity inside a Telegram-created vote', () => {
  const result = syncVoteToBench(
    {
      ...createVote(),
      votes: {
        'zalo:user-2': {
          id: 'user-2',
          platform: 'zalo',
          name: 'Minh',
          choice: '+2',
        },
      },
    },
    []
  );

  assert.deepEqual(result.bench, [
    [
      'zalo:user-2',
      {
        name: 'Minh',
        identity: { platform: 'zalo', externalId: 'user-2' },
      },
    ],
    [
      'vote-guest:zalo:user-2:1',
      { name: 'Minh 1', memberId: 'vote-guest:zalo:user-2:1' },
    ],
  ]);
});

test('independent /sync saves one atomic bench update', async () => {
  const { router, saves } = createSyncRouter();

  const routed = await router.run(createContext());

  assert.equal(saves.length, 1);
  assert.deepEqual(Object.keys(saves[0]), ['bench']);
  assert.match(routed.result.messages[0].text, /ĐÃ ĐỒNG BỘ TỪ VOTE/);
  assert.match(routed.result.messages[0].text, /Bob 2/);
  assert.equal(routed.result.messages[0].channel, 'announcement');
});

test('independent /sync handles no vote, invalid input, and no attendees', async () => {
  const noVote = createSyncRouter({
    state: { activeVote: null, bench: [] },
  });
  const noAttendees = createSyncRouter({
    state: {
      activeVote: {
        ...createVote(),
        votes: { 1: { id: 1, name: 'Alice', choice: '0' } },
      },
      bench: [],
    },
  });

  const noVoteResult = await noVote.router.run(createContext());
  const invalidResult = await noVote.router.run(createContext(['extra']));
  const emptyResult = await noAttendees.router.run(createContext());

  assert.equal(noVoteResult.result.messages[0].text, SYNC_MESSAGES.noVote);
  assert.equal(invalidResult.result.messages[0].text, SYNC_MESSAGES.usage);
  assert.match(emptyResult.result.messages[0].text, /Không có người tham gia/);
  assert.equal(noAttendees.saves.length, 0);
});

test('independent /sync enforces permission and reports repository errors', async () => {
  const denied = createSyncRouter({ isAdmin: false });
  const loadFailure = createSyncRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createSyncRouter({
    saveError: new Error('API unavailable'),
  });

  const deniedResult = await denied.router.run(createContext([], '999'));
  const loadResult = await loadFailure.router.run(createContext());
  const saveResult = await saveFailure.router.run(createContext());

  assert.equal(
    deniedResult.result.messages[0].text,
    SYNC_MESSAGES.permissionDenied
  );
  assert.equal(denied.getLoadCount(), 0);
  assert.equal(loadResult.result.messages[0].text, SYNC_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, SYNC_MESSAGES.saveError);
});
