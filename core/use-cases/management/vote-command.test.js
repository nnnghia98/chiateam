const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const { ATTENDANCE_VOTE_OPTIONS } = require('./attendance-vote');
const {
  VOTE_MESSAGES,
  createVoteCommand,
  parseVoteChoice,
} = require('./vote-command');

function createContext(args = [], overrides = {}) {
  return {
    command: 'vote',
    args,
    actor: {
      platform: 'zalo',
      externalId: 'zalo-user',
      displayName: 'Minh',
      ...overrides,
    },
    conversation: { externalId: 'zalo-chat', threadId: null },
  };
}

function createVote() {
  return {
    id: 'poll-1',
    platform: 'telegram',
    question: 'Sân A 20h',
    options: ATTENDANCE_VOTE_OPTIONS,
    totalVoters: 1,
    votes: {
      123: { id: 123, name: 'Lan', options: [1] },
    },
  };
}

function createVoteRouter({
  state = { activeVote: createVote() },
  loadError,
  saveError,
} = {}) {
  const saves = [];
  const router = createCommandRouter({
    registry: createCommandRegistry([createVoteCommand()]),
    stateRepository: createStateRepository({
      async load(keys) {
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

  return { router, saves, state };
}

test('text vote parser accepts 0 through 4 with an optional plus', () => {
  assert.deepEqual(parseVoteChoice(['0']), { choice: '0', choiceIndex: 0 });
  assert.deepEqual(parseVoteChoice(['1']), { choice: '+1', choiceIndex: 1 });
  assert.deepEqual(parseVoteChoice(['+4']), {
    choice: '+4',
    choiceIndex: 4,
  });
  assert.equal(parseVoteChoice([]), null);
  assert.equal(parseVoteChoice(['5']), null);
  assert.equal(parseVoteChoice(['1', '2']), null);
});

test('independent /vote stores a platform-qualified voter', async () => {
  const { router, saves, state } = createVoteRouter();

  const routed = await router.run(createContext(['2']));

  assert.equal(saves.length, 1);
  assert.deepEqual(state.activeVote.votes['zalo:zalo-user'], {
    id: 'zalo-user',
    platform: 'zalo',
    name: 'Minh',
    choice: '+2',
    optionIndex: 2,
    options: [2],
  });
  assert.equal(state.activeVote.totalVoters, 2);
  assert.match(routed.result.messages[0].text, /Minh: tham gia 2 người/);
  assert.equal(routed.result.messages[0].channel, 'source');
});

test('independent /vote changes a choice and skips an unchanged save', async () => {
  const { router, saves, state } = createVoteRouter();

  await router.run(createContext(['+2']));
  const unchanged = await router.run(createContext(['2']));
  const declined = await router.run(createContext(['0']));

  assert.equal(saves.length, 2);
  assert.match(unchanged.result.messages[0].text, /vẫn chọn tham gia 2/);
  assert.match(declined.result.messages[0].text, /không tham gia/);
  assert.equal(state.activeVote.totalVoters, 1);
  assert.equal(state.activeVote.votes['zalo:zalo-user'].choice, '0');
});

test('independent /vote handles invalid, empty, and repository failures', async () => {
  const valid = createVoteRouter();
  const empty = createVoteRouter({ state: { activeVote: null } });
  const invalid = createVoteRouter({
    state: { activeVote: { question: 'bad' } },
  });
  const loadFailure = createVoteRouter({
    loadError: new Error('API unavailable'),
  });
  const saveFailure = createVoteRouter({
    saveError: new Error('API unavailable'),
  });

  const invalidInput = await valid.router.run(createContext(['5']));
  const noVote = await empty.router.run(createContext(['1']));
  const invalidState = await invalid.router.run(createContext(['1']));
  const loadResult = await loadFailure.router.run(createContext(['1']));
  const saveResult = await saveFailure.router.run(createContext(['1']));

  assert.equal(invalidInput.result.messages[0].text, VOTE_MESSAGES.usage);
  assert.equal(noVote.result.messages[0].text, VOTE_MESSAGES.noVote);
  assert.equal(invalidState.result.messages[0].text, VOTE_MESSAGES.loadError);
  assert.equal(loadResult.result.messages[0].text, VOTE_MESSAGES.loadError);
  assert.equal(saveResult.result.messages[0].text, VOTE_MESSAGES.saveError);
});
