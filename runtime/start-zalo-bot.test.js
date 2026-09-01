const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  ATTENDANCE_VOTE_OPTIONS,
} = require('../core/use-cases/management/attendance-vote');
const { createStateRepository } = require('../core/ports/state-repository');
const {
  createZaloPermissionPolicy,
} = require('../platforms/zalo/permission-policy');
const {
  ZALO_COMMAND_NAMES,
  createZaloCommandDefinitions,
} = require('./create-zalo-command-definitions');
const { startZaloBotRuntime } = require('./start-zalo-bot');

class MockZaloClient extends EventEmitter {
  constructor() {
    super();
    this.sentMessages = [];
  }

  async sendMessage(chatId, text, options) {
    this.sentMessages.push({ chatId, text, options });
    return { message_id: `sent-${this.sentMessages.length}` };
  }
}

function createUpdate(text, userId, displayName, messageId) {
  return {
    ok: true,
    result: {
      event_name: 'message.text.received',
      message: {
        from: { id: userId, display_name: displayName, is_bot: false },
        chat: { id: 'zalo-chat', chat_type: 'GROUP' },
        text,
        message_id: messageId,
        date: 1,
      },
    },
  };
}

test('Zalo runtime exposes only announcement and player actions', async () => {
  const client = new MockZaloClient();
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
  const runtime = startZaloBotRuntime({
    client,
    stateRepository: repository,
    permissionPolicy: createZaloPermissionPolicy({
      env: { ZALO_BOT_OWNER_ID: 'owner' },
    }),
    definitions: createZaloCommandDefinitions(),
  });

  assert.deepEqual(
    runtime.registry.list().map(definition => definition.name),
    ZALO_COMMAND_NAMES
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
  assert.doesNotMatch(help, /\/addme|\/chiateam|\/register|\(admin\)/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/addme', 'owner', 'Owner', 'message-2')
    ),
    false
  );
  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/chiateam', 'owner', 'Owner', 'message-3')
    ),
    false
  );
  assert.equal(client.sentMessages.length, 1);
  assert.equal(saves.length, 0);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/poll', 'player-2', 'Minh', 'message-4')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /VOTE ĐANG MỞ/);
  assert.ok(client.sentMessages.at(-1).text.includes('/vote \\+2'));

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/vote 2', 'player-2', 'Minh', 'message-5')
    ),
    true
  );
  assert.equal(state.activeVote.votes['zalo:player-2'].choice, '+2');
  assert.equal(state.activeVote.votes['zalo:player-2'].platform, 'zalo');
  assert.equal(state.activeVote.totalVoters, 2);
  assert.equal(saves.length, 1);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/demvote', 'player-2', 'Minh', 'message-6')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /Minh/);
  assert.match(client.sentMessages.at(-1).text, /Số người vote/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/bench', 'player-2', 'Minh', 'message-7')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /1\. Lan\n2\. Minh/);

  assert.equal(
    await runtime.adapter.handleUpdate(
      createUpdate('/team', 'player-2', 'Minh', 'message-8')
    ),
    true
  );
  assert.match(client.sentMessages.at(-1).text, /HOME \(1\)/);
  assert.match(client.sentMessages.at(-1).text, /AWAY \(1\)/);

  runtime.stop();
  assert.equal(client.listenerCount('message'), 0);
});

test('Zalo runtime can skip client listeners for webhook delivery', () => {
  const client = new MockZaloClient();
  const runtime = startZaloBotRuntime({
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
