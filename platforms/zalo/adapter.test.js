const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  createRichTextResult,
  createTextResult,
} = require('../../core/contracts/command-result');
const {
  ZALO_CAPABILITIES,
  createZaloAdapter,
  parseZaloCommandText,
} = require('./adapter');

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

function createUpdate(text = '/bench', overrides = {}) {
  return {
    ok: true,
    result: {
      event_name: 'message.text.received',
      message: {
        from: {
          id: 'user-1',
          display_name: 'Nghia',
          is_bot: false,
          ...overrides.from,
        },
        chat: {
          id: 'chat-1',
          chat_type: 'PRIVATE',
          ...overrides.chat,
        },
        text,
        message_id: overrides.messageId || 'message-1',
        date: 1,
      },
    },
  };
}

test('Zalo command parser supports command arguments', () => {
  assert.deepEqual(parseZaloCommandText('/TEAM 3'), {
    command: 'TEAM',
    args: ['3'],
    rawArgs: '3',
  });
  assert.equal(parseZaloCommandText('hello'), null);
  assert.equal(parseZaloCommandText('/bad.command'), null);
});

test('Zalo adapter creates a platform-neutral context', () => {
  const adapter = createZaloAdapter({
    client: new MockZaloClient(),
    router: { run: async () => ({ handled: false }) },
  });

  assert.deepEqual(adapter.toCommandContext(createUpdate('/team 3')), {
    command: 'team',
    args: ['3'],
    rawArgs: '3',
    actor: {
      platform: 'zalo',
      externalId: 'user-1',
      displayName: 'Nghia',
      username: null,
    },
    conversation: {
      externalId: 'chat-1',
      threadId: null,
      type: 'private',
    },
  });
  assert.deepEqual(adapter.capabilities, ZALO_CAPABILITIES);
});

test('Zalo adapter renders rich text and replies to the source chat', async () => {
  const client = new MockZaloClient();
  const adapter = createZaloAdapter({
    client,
    router: {
      async run() {
        return {
          handled: true,
          result: createRichTextResult(
            [{ text: 'Choose', bold: true }],
            [
              {
                id: 'view_team',
                label: 'View team',
                command: '/team',
              },
            ],
            { channel: 'main' }
          ),
        };
      },
    },
  });

  assert.equal(await adapter.handleUpdate(createUpdate('/start')), true);
  assert.deepEqual(client.sentMessages, [
    {
      chatId: 'chat-1',
      text: '**Choose**\n\n1. View team — /team',
      options: { parse_mode: 'markdown' },
    },
  ]);
});

test('Zalo adapter handles pending text and ignores duplicate events', async () => {
  const client = new MockZaloClient();
  const contexts = [];
  const adapter = createZaloAdapter({
    client,
    router: {
      async run(context) {
        contexts.push(context);

        if (context.args.length === 1) {
          return {
            handled: true,
            result: createTextResult('Enter name.', [], {
              input: { command: 'editbench', args: context.args },
            }),
          };
        }

        return {
          handled: true,
          result: createTextResult(`Renamed to ${context.args[1]}.`),
        };
      },
    },
  });

  const command = createUpdate('/editbench 2');
  assert.equal(await adapter.handleUpdate(command), true);
  assert.equal(await adapter.handleUpdate(command), true);
  assert.equal(
    await adapter.handleUpdate(
      createUpdate('Minh New', { messageId: 'message-2' })
    ),
    true
  );

  assert.deepEqual(
    contexts.map(context => ({
      command: context.command,
      args: context.args,
    })),
    [
      { command: 'editbench', args: ['2'] },
      { command: 'editbench', args: ['2', 'Minh New'] },
    ]
  );
  assert.equal(client.sentMessages.length, 2);
});

test('Zalo adapter registers and removes one message listener', () => {
  const client = new MockZaloClient();
  const adapter = createZaloAdapter({
    client,
    router: { run: async () => ({ handled: false }) },
  });

  adapter.start();
  adapter.start();
  assert.equal(client.listenerCount('message'), 1);

  adapter.stop();
  assert.equal(client.listenerCount('message'), 0);
});

test('private text refreshes names once, including plain text and unknown commands', async () => {
  const profiles = [];
  const client = new MockZaloClient();
  const adapter = createZaloAdapter({
    client,
    router: { run: async () => ({ handled: false }) },
    onPrivateMessage: async profile => profiles.push(profile),
  });
  const hello = createUpdate('hello');
  await Promise.all([adapter.handleUpdate(hello), adapter.handleUpdate(hello)]);
  await adapter.handleUpdate(hello);
  await adapter.handleUpdate(
    createUpdate('/unknown', {
      messageId: '2',
      from: { display_name: 'New name' },
    })
  );
  await adapter.handleUpdate(
    createUpdate('group text', { messageId: '3', chat: { chat_type: 'GROUP' } })
  );
  await adapter.handleUpdate(
    createUpdate('blank name', { messageId: '4', from: { display_name: '  ' } })
  );
  await adapter.handleUpdate(
    createUpdate('bot', { messageId: '5', from: { is_bot: true } })
  );
  await adapter.handleUpdate({ invalid: true });
  assert.deepEqual(profiles, [
    {
      userId: 'user-1',
      chatId: 'chat-1',
      chatType: 'private',
      displayName: 'Nghia',
    },
    {
      userId: 'user-1',
      chatId: 'chat-1',
      chatType: 'private',
      displayName: 'New name',
    },
  ]);
  assert.equal(client.sentMessages.length, 0);
});

test('failed name refresh does not prevent replies or expose raw errors', async () => {
  const errors = [];
  const client = new MockZaloClient();
  const adapter = createZaloAdapter({
    client,
    router: {
      run: async () => ({
        handled: true,
        result: createTextResult('Team reply'),
      }),
    },
    onPrivateMessage: async () => {
      throw new Error('secret token and user data');
    },
    onError: error => {
      errors.push(error.message);
      throw new Error('logger failed');
    },
  });
  assert.equal(await adapter.handleUpdate(createUpdate()), true);
  assert.equal(client.sentMessages[0].text, 'Team reply');
  assert.deepEqual(errors, ['Zalo subscriber name refresh failed.']);
});

test('a failed automatic greeting does not stop the first command', async () => {
  const errors = [];
  const client = new MockZaloClient();
  const sendMessage = client.sendMessage.bind(client);
  let attempts = 0;
  client.sendMessage = async (...args) => {
    if (++attempts === 1) throw new Error('private send error');
    return sendMessage(...args);
  };
  let claimed = false;
  const adapter = createZaloAdapter({
    client,
    greetingRepository: {
      claim: async () => {
        const first = !claimed;
        claimed = true;
        return first;
      },
    },
    router: {
      run: async () => ({
        handled: true,
        result: createTextResult('Command reply'),
      }),
    },
    onError: error => errors.push(error.message),
  });
  await adapter.handleUpdate(createUpdate('/subscribe'));
  assert.equal(client.sentMessages[0].text, 'Command reply');
  assert.deepEqual(errors, ['Zalo greeting failed.']);
  await adapter.handleUpdate(createUpdate('hello', { messageId: 'later' }));
  assert.equal(attempts, 2);
});
