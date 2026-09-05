const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { EventEmitter } = require('node:events');

const { createStateRepository } = require('../core/ports/state-repository');
const {
  createMessengerWebhookApplication,
  requireEnvironmentValue,
} = require('./create-messenger-webhook-application');

class MockMessengerClient extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
  }

  async sendMessage(recipientId, text, options) {
    this.messages.push({ recipientId, text, options });
    return { message_id: `sent-${this.messages.length}` };
  }
}

function createStartPayload() {
  return {
    object: 'page',
    entry: [
      {
        id: 'page-1',
        time: 1,
        messaging: [
          {
            sender: { id: 'user-1', name: 'Nghia' },
            recipient: { id: 'page-1' },
            timestamp: 2,
            message: { mid: 'message-1', text: '/start' },
          },
        ],
      },
    ],
  };
}

function createMemoryStateRepository() {
  return createStateRepository({
    load: async () => ({}),
    save: async changes => changes,
  });
}

function createMemoryEventRepository() {
  return {
    claim: async () => ({ state: 'claimed', claimId: 'claim-1' }),
    complete: async () => true,
    release: async () => true,
  };
}

test('Messenger webhook application routes without polling listeners', async () => {
  const client = new MockMessengerClient();
  const lifecycle = [];
  const appSecret = 'app-secret-123';
  const application = createMessengerWebhookApplication({
    client,
    appSecret,
    stateRepository: createMemoryStateRepository(),
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
  const rawBody = Buffer.from(JSON.stringify(createStartPayload()));
  const signature = `sha256=${createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  assert.equal(client.listenerCount('message'), 0);
  assert.deepEqual(
    await application.handleWebhook({
      headers: { 'X-Hub-Signature-256': signature },
      body: rawBody.toString('utf8'),
      rawBody,
    }),
    { statusCode: 200, body: { ok: true } }
  );
  assert.equal(client.messages.length, 1);
  assert.equal(client.messages[0].recipientId, 'user-1');
  assert.match(client.messages[0].text, /\/poll/);
  assert.match(client.messages[0].text, /\/vote/);
  assert.doesNotMatch(client.messages[0].text, /\/addme|\/chiateam|\/zalosay/);
  assert.deepEqual(
    lifecycle.map(([operation]) => operation),
    ['claim', 'complete']
  );
});

test('Messenger webhook application requires production secrets', () => {
  assert.equal(requireEnvironmentValue({ TOKEN: ' value ' }, 'TOKEN'), 'value');
  assert.throws(() => requireEnvironmentValue({}, 'TOKEN'), /Missing TOKEN/);

  assert.throws(
    () =>
      createMessengerWebhookApplication({
        env: {},
        stateRepository: createMemoryStateRepository(),
        eventRepository: createMemoryEventRepository(),
      }),
    /Missing MESSENGER_PAGE_ID/
  );
  assert.throws(
    () =>
      createMessengerWebhookApplication({
        env: {},
        client: new MockMessengerClient(),
        stateRepository: createMemoryStateRepository(),
        eventRepository: createMemoryEventRepository(),
      }),
    /Missing MESSENGER_APP_SECRET/
  );
});

test('Messenger webhook application creates the Graph client from env', () => {
  const application = createMessengerWebhookApplication({
    env: {
      MESSENGER_PAGE_ID: '123456',
      MESSENGER_PAGE_ACCESS_TOKEN: 'page-token',
      MESSENGER_APP_SECRET: 'app-secret',
      MESSENGER_GRAPH_API_VERSION: 'v24.0',
    },
    stateRepository: createMemoryStateRepository(),
    eventRepository: createMemoryEventRepository(),
  });

  assert.equal(application.client.pageId, '123456');
  assert.equal(application.client.graphApiVersion, 'v24.0');
  assert.equal(application.client.listenerCount('message'), 0);
  application.stop();
});
