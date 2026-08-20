const test = require('node:test');
const assert = require('node:assert/strict');

function createMockBot() {
  const textHandlers = [];
  const eventHandlers = [];

  return {
    textHandlers,
    eventHandlers,
    bot: {
      onText(pattern, handler) {
        textHandlers.push({ pattern, handler });
      },
      on(event, handler) {
        eventHandlers.push({ event, handler });
      },
      async sendMessage() {
        return { ok: true };
      },
      async sendPoll() {
        return { poll: { id: 'legacy-poll' }, message_id: 1 };
      },
    },
  };
}

function loadCommand(mockBot) {
  const commandPath = require.resolve('./tao-vote');
  const chatPath = require.resolve('../../utils/chat');
  const permissionsPath = require.resolve('../../utils/permissions');
  const telegramClientPath = require.resolve('../../telegram-client');

  delete require.cache[commandPath];
  delete require.cache[chatPath];
  delete require.cache[permissionsPath];
  delete require.cache[telegramClientPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require(commandPath);
}

test('legacy vote handlers leave migrated commands to shared runtime', () => {
  const mock = createMockBot();
  const voteCommand = loadCommand(mock.bot);
  let activeVote = {
    id: 'poll-123',
    question: 'Sân A 20h',
    options: ['0', '+1', '+2', '+3', '+4'],
    totalVoters: 0,
    votes: {},
  };

  voteCommand({
    members: new Map(),
    getActiveVote: () => activeVote,
    setActiveVote: value => {
      activeVote = value;
    },
    registerCreateCommand: false,
    registerCountCommand: false,
    registerClearCommand: false,
    registerSyncCommand: false,
  });

  assert.equal(
    mock.textHandlers.some(({ pattern }) => pattern.test('/taovote Sân A 20h')),
    false
  );
  assert.equal(
    mock.textHandlers.some(({ pattern }) => pattern.test('/demvote')),
    false
  );
  assert.equal(
    mock.textHandlers.some(({ pattern }) => pattern.test('/sync')),
    false
  );
  assert.equal(
    mock.textHandlers.some(({ pattern }) => pattern.test('/clearvote')),
    false
  );

  const pollAnswerHandler = mock.eventHandlers.find(
    ({ event }) => event === 'poll_answer'
  );
  assert.ok(pollAnswerHandler);

  pollAnswerHandler.handler({
    poll_id: 'poll-123',
    user: { id: 999, first_name: 'Alice' },
    option_ids: [2],
  });

  assert.deepEqual(activeVote.votes['999'], {
    id: 999,
    name: 'Alice',
    options: [2],
  });
  assert.equal(activeVote.totalVoters, 1);
});
