const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createStateRepository } = require('../core/ports/state-repository');
const {
  createZaloWebhookApplication,
  requireEnvironmentValue,
} = require('./create-zalo-webhook-application');

class MockZaloClient extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
  }

  async sendMessage(chatId, text, options) {
    this.messages.push({ chatId, text, options });
    return { message_id: `sent-${this.messages.length}` };
  }
}

function createStartUpdate() {
  return {
    ok: true,
    result: {
      event_name: 'message.text.received',
      message: {
        from: { id: 'user-1', display_name: 'Nghia' },
        chat: { id: 'chat-1', chat_type: 'PRIVATE' },
        text: '/start',
        message_id: 'message-1',
      },
    },
  };
}

test('Zalo webhook application routes without polling listeners', async () => {
  const client = new MockZaloClient();
  const lifecycle = [];
  const application = createZaloWebhookApplication({
    client,
    secretToken: 'secret-123',
    stateRepository: createStateRepository({
      load: async () => ({}),
      save: async changes => changes,
    }),
    eventRepository: {
      async claim(event) {
        lifecycle.push(['claim', event]);
        return { state: 'claimed', claimId: 'claim-1' };
      },
      async complete(event) {
        lifecycle.push(['complete', event]);
        return true;
      },
      async release(event) {
        lifecycle.push(['release', event]);
        return true;
      },
    },
  });

  assert.equal(client.listenerCount('message'), 0);
  assert.deepEqual(
    await application.handleWebhook({
      headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
      body: createStartUpdate(),
    }),
    { statusCode: 200, body: { ok: true } }
  );
  assert.equal(client.messages.length, 1);
  assert.match(client.messages[0].text, /\/poll/);
  assert.doesNotMatch(client.messages[0].text, /\/addme|\/chiateam/);
  assert.deepEqual(
    lifecycle.map(([operation]) => operation),
    ['claim', 'complete']
  );
});

test('Zalo webhook application requires production secrets', () => {
  assert.equal(requireEnvironmentValue({ TOKEN: ' value ' }, 'TOKEN'), 'value');
  assert.throws(() => requireEnvironmentValue({}, 'TOKEN'), /Missing TOKEN/);
});
