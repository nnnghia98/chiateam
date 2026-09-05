const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  ATTENDANCE_VOTE_OPTIONS,
} = require('../core/use-cases/management/attendance-vote');
const { createStateRepository } = require('../core/ports/state-repository');
const {
  createMessengerPermissionPolicy,
} = require('../platforms/messenger/permission-policy');
const {
  MESSENGER_COMMAND_NAMES,
  createMessengerCommandDefinitions,
} = require('./create-messenger-command-definitions');
const { startMessengerBotRuntime } = require('./start-messenger-bot');

class MockMessengerClient extends EventEmitter {
  constructor() {
    super();
    this.sentMessages = [];
  }

  async sendMessage(recipientId, text, options) {
    this.sentMessages.push({ recipientId, text, options });
    return { message_id: `sent-${this.sentMessages.length}` };
  }
}

function createUpdate(text, userId, displayName, messageId) {
  return {
    sender: { id: userId, name: displayName },
    recipient: { id: 'page-1' },
    timestamp: 1,
    message: { mid: messageId, text },
  };
}

test('Messenger runtime exposes only shared vote and read commands', async () => {
  const client = new MockMessengerClient();
  const state = {
    activeVote: {
      id: 'telegram-poll-1',
      platform: 'telegram',
      question: 'Sân A 20h',
      options: ATTENDANCE_VOTE_OPTIONS,
      totalVoters: 1,
      votes: {
        123: { id: 123, name: 'Lan', options: [1] },
      },
    },
    bench: [
      ['member-1', { name: 'Lan', memberId: 'member-1' }],
      ['member-2', { name: 'Minh', memberId: 'member-2' }],
    ],
    teamA: [['member-1', { name: 'Lan', memberId: 'member-1' }]],
    teamB: [['member-2', { name: 'Minh', memberId: 'member-2' }]],
    team3A: [],
    team3B: [],
    team3C: [],
    manifest: [],
  };
  const saves = [];
  const repository = createStateRepository({
    async load(keys) {
      return Object.fromEntries(keys.map(key => [key, state[key]]));
    },
    async save(changes) {
      saves.push(changes);
      Object.assign(state, changes);
      return state;
    },
  });
  const runtime = startMessengerBotRuntime({
    client,
    stateRepository: repository,
    permissionPolicy: createMessengerPermissionPolicy(),
    definitions: createMessengerCommandDefinitions(),
  });

  assert.deepEqual(
    runtime.registry.list().map(definition => definition.name),
    MESSENGER_COMMAND_NAMES
  );

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/start', 'owner', 'Owner', 'message-1')
    ),
    true
  );
  const help = client.sentMessages.at(-1).text;
  ['/poll', '/vote', '/demvote', '/bench', '/team'].forEach(command => {
    assert.match(help, new RegExp(command));
  });
  assert.doesNotMatch(help, /\/addme|\/chiateam|\/register|\/zalosay/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/addme', 'owner', 'Owner', 'message-2')
    ),
    false
  );
  assert.equal(client.sentMessages.length, 1);
  assert.equal(saves.length, 0);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/poll', 'player-2', 'Minh', 'message-3')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /VOTE ĐANG MỞ/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/vote 2', 'player-2', 'Minh', 'message-4')
    ),
    true
  );
  assert.equal(state.activeVote.votes['messenger:player-2'].choice, '+2');
  assert.equal(
    state.activeVote.votes['messenger:player-2'].platform,
    'messenger'
  );
  assert.equal(saves.length, 1);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/demvote', 'player-2', 'Minh', 'message-5')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /Minh/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/bench', 'player-2', 'Minh', 'message-6')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /1\. Lan\n2\. Minh/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/team', 'player-2', 'Minh', 'message-7')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /HOME \(1\)/);
  assert.match(client.sentMessages.at(-1).text, /AWAY \(1\)/);

  runtime.stop();
  assert.equal(client.listenerCount('message'), 0);
});

test('Messenger runtime can skip client listeners for webhook delivery', () => {
  const client = new MockMessengerClient();
  const runtime = startMessengerBotRuntime({
    client,
    definitions: [],
    stateRepository: createStateRepository({
      load: async () => ({}),
      save: async changes => changes,
    }),
    listenForClientEvents: false,
  });

  assert.equal(client.listenerCount('message'), 0);
  runtime.stop();
});
