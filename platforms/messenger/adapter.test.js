const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createTextResult } = require('../../core/contracts/command-result');
const {
  createMessengerAdapter,
  MESSENGER_CAPABILITIES,
  parseMessengerCommandText,
} = require('./adapter');

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

function createUpdate(text = '/bench', mid = 'mid-1', sender = 'psid-1') {
  return {
    sender: { id: sender, name: 'Nghia' },
    recipient: { id: 'page-1' },
    timestamp: 1,
    message: { mid, text },
  };
}

test('Messenger parser and context use sender PSID as conversation ID', () => {
  assert.deepEqual(parseMessengerCommandText('/TEAM 3'), {
    command: 'TEAM',
    args: ['3'],
  });
  assert.equal(parseMessengerCommandText('hello'), null);
  const adapter = createMessengerAdapter({
    client: new MockMessengerClient(),
    router: { run: async () => ({ handled: false }) },
  });
  assert.deepEqual(adapter.toCommandContext(createUpdate('/team 3')), {
    command: 'team',
    args: ['3'],
    actor: {
      platform: 'messenger',
      externalId: 'psid-1',
      displayName: 'Nghia',
      username: null,
    },
    conversation: { externalId: 'psid-1', threadId: null },
  });
  assert.deepEqual(adapter.capabilities, MESSENGER_CAPABILITIES);
});

test('Messenger adapter sends results, handles pending input, and deduplicates events', async () => {
  const client = new MockMessengerClient();
  const contexts = [];
  const adapter = createMessengerAdapter({
    client,
    router: {
      async run(context) {
        contexts.push(context);
        return context.args.length === 1
          ? {
              handled: true,
              result: createTextResult('Enter name.', [], {
                input: { command: 'editbench', args: context.args },
              }),
            }
          : {
              handled: true,
              result: createTextResult(`Renamed to ${context.args[1]}.`),
            };
      },
    },
  });
  assert.equal(await adapter.handleUpdate(createUpdate('/editbench 2')), true);
  assert.equal(await adapter.handleUpdate(createUpdate('/editbench 2')), true);
  assert.equal(
    await adapter.handleUpdate(createUpdate('Minh New', 'mid-2')),
    true
  );
  assert.deepEqual(
    contexts.map(c => ({ command: c.command, args: c.args })),
    [
      { command: 'editbench', args: ['2'] },
      { command: 'editbench', args: ['2', 'Minh New'] },
    ]
  );
  assert.deepEqual(
    client.sentMessages.map(message => message.recipientId),
    ['psid-1', 'psid-1']
  );
});

test('Messenger adapter manages one message listener', () => {
  const client = new MockMessengerClient();
  const adapter = createMessengerAdapter({
    client,
    router: { run: async () => ({ handled: false }) },
  });
  adapter.start();
  adapter.start();
  assert.equal(client.listenerCount('message'), 1);
  adapter.stop();
  assert.equal(client.listenerCount('message'), 0);
});
