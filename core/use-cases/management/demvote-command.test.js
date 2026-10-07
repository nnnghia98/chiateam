const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createStateRepository } = require('../../ports/state-repository');
const {
  ATTENDANCE_VOTE_OPTIONS,
  LEGACY_ATTENDANCE_VOTE_OPTIONS,
} = require('./attendance-vote');
const { DEMVOTE_MESSAGES, createDemvoteCommand } = require('./demvote-command');

function createContext(args = []) {
  return {
    command: 'dempoll',
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

function createDemvoteRouter({ state = { activeVote: null }, loadError } = {}) {
  let saveCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createDemvoteCommand()]),
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

test('independent /dempoll reports no active vote', async () => {
  const { router, getSaveCount } = createDemvoteRouter();

  for (const command of ['dempoll', 'demvote']) {
    const routed = await router.run({ ...createContext(), command });
    assert.equal(routed.command, 'dempoll');
    assert.equal(routed.result.messages[0].text, DEMVOTE_MESSAGES.noVote);
    assert.equal(routed.result.messages[0].channel, 'default');
  }
  assert.equal(getSaveCount(), 0);
});

test('legacy poll rules still pause canonical and alias commands', async () => {
  const {
    createManagedCommandRules,
  } = require('../../commands/managed-command-rules');
  const definition = createDemvoteCommand();
  const rules = createManagedCommandRules({
    TELEGRAM_COMMAND_RULES: JSON.stringify({ demvote: { enabled: false } }),
  });
  const router = createCommandRouter({
    registry: createCommandRegistry([definition]),
    commandRules: rules,
    stateRepository: createStateRepository({
      load: async () => {
        throw new Error('Paused commands must not load state');
      },
      save: async () => {},
    }),
  });
  for (const command of ['dempoll', 'demvote']) {
    const routed = await router.run({ ...createContext(), command });
    assert.match(routed.result.messages[0].text, /paused/);
  }
  assert.deepEqual(
    createManagedCommandRules({
      TELEGRAM_COMMAND_RULES:
        '{"demvote":{"enabled":false},"dempoll":{"enabled":true}}',
    })(createContext(), definition),
    { enabled: true }
  );
});

test('independent /dempoll summarizes legacy and neutral choices', async () => {
  const { router, getSaveCount } = createDemvoteRouter({
    state: {
      activeVote: {
        id: 'poll-1',
        question: 'Sân A 20h',
        options: LEGACY_ATTENDANCE_VOTE_OPTIONS,
        votes: {
          1: { id: 1, name: 'Alice', options: [4] },
          2: { id: 2, name: 'Bob', choice: '+4' },
          3: { id: 3, name: 'Carol', options: [0] },
        },
      },
    },
  });

  const routed = await router.run(createContext());
  const message = routed.result.messages[0];

  assert.match(message.text, /^📊 Kết quả vote hiện tại:\nSân A 20h/);
  assert.match(message.text, /Đá \(2\)\nAi vote\? Alice, Bob/);
  assert.match(message.text, /Thôi \(1\)\nAi vote\? Carol/);
  assert.match(message.text, /Số người vote: 8$/);
  assert.equal(message.channel, 'main');
  assert.equal(message.segments[0].bold, true);
  assert.equal(getSaveCount(), 0);
});

test('independent /dempoll ignores retracted votes in the summary', async () => {
  const { router } = createDemvoteRouter({
    state: {
      activeVote: {
        question: 'Sân A 20h',
        options: ATTENDANCE_VOTE_OPTIONS,
        votes: {
          1: { id: 1, name: 'Alice', options: [] },
        },
      },
    },
  });

  const routed = await router.run(createContext());

  assert.match(routed.result.messages[0].text, /Số người vote: 0$/);
  assert.doesNotMatch(routed.result.messages[0].text, /Alice/);
});

test('independent /dempoll handles invalid input, state, and load errors', async () => {
  const valid = createDemvoteRouter();
  const invalidState = createDemvoteRouter({
    state: { activeVote: { question: 'bad' } },
  });
  const loadFailure = createDemvoteRouter({
    loadError: new Error('API unavailable'),
  });

  const inputResult = await valid.router.run(createContext(['extra']));
  const stateResult = await invalidState.router.run(createContext());
  const loadResult = await loadFailure.router.run(createContext());

  assert.equal(inputResult.result.messages[0].text, DEMVOTE_MESSAGES.usage);
  assert.equal(stateResult.result.messages[0].text, DEMVOTE_MESSAGES.loadError);
  assert.equal(loadResult.result.messages[0].text, DEMVOTE_MESSAGES.loadError);
});
