const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const { ATTENDANCE_VOTE_OPTIONS } = require('./attendance-vote');
const { POLL_MESSAGES, createPollCommand } = require('./poll-command');

function createContext(args = []) {
  return {
    command: 'poll',
    args,
    actor: {
      platform: 'zalo',
      externalId: 'zalo-user',
      displayName: 'Minh',
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
    votes: {},
  };
}

function createPollRouter({
  state = { activeVote: createVote() },
  loadError,
} = {}) {
  let saveCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createPollCommand()]),
    stateRepository: createStateRepository({
      async load(keys) {
        assert.deepEqual(keys, ['activeVote']);
        if (loadError) throw loadError;
        return state;
      },
      async save() {
        saveCount += 1;
        return state;
      },
    }),
  });

  return { router, getSaveCount: () => saveCount };
}

test('independent /poll shows the active vote as text actions', async () => {
  const { router, getSaveCount } = createPollRouter();

  const routed = await router.run(createContext());
  const message = routed.result.messages[0];

  assert.match(message.text, /^📊 VOTE ĐANG MỞ\n\nSân A 20h/);
  assert.equal(message.channel, 'announcement');
  assert.deepEqual(
    message.actions.map(action => action.command),
    ['/vote 0', '/vote +1', '/vote +2', '/vote +3', '/vote +4']
  );
  assert.equal(getSaveCount(), 0);
});

test('independent /poll handles empty, invalid, and failed states', async () => {
  const empty = createPollRouter({ state: { activeVote: null } });
  const invalid = createPollRouter({
    state: { activeVote: { question: 'bad' } },
  });
  const failed = createPollRouter({ loadError: new Error('API unavailable') });

  const invalidArgs = await empty.router.run(createContext(['extra']));
  const emptyResult = await empty.router.run(createContext());
  const invalidResult = await invalid.router.run(createContext());
  const failedResult = await failed.router.run(createContext());

  assert.equal(invalidArgs.result.messages[0].text, POLL_MESSAGES.usage);
  assert.equal(emptyResult.result.messages[0].text, POLL_MESSAGES.noVote);
  assert.equal(invalidResult.result.messages[0].text, POLL_MESSAGES.loadError);
  assert.equal(failedResult.result.messages[0].text, POLL_MESSAGES.loadError);
});
