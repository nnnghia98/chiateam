const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createStateRepository } = require('../core/ports/state-repository');
const {
  createZaloWebhookApplication,
  requireEnvironmentValue,
} = require('./create-zalo-webhook-application');
const { createPermissiveBotControlsGate } = require('./bot-controls');

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
  const profiles = [];
  const application = createZaloWebhookApplication({
    client,
    commandGate: createPermissiveBotControlsGate(),
    secretToken: 'secret-123',
    greetingRepository: { claim: async () => true },
    subscriptionRepository: {
      refreshSubscriber: async profile => profiles.push(profile),
    },
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
  assert.match(client.messages[0].text, /Chào Nghia! Đây là bot ChiaTeam/);
  assert.deepEqual(profiles, [
    {
      userId: 'user-1',
      chatId: 'chat-1',
      chatType: 'private',
      displayName: 'Nghia',
    },
  ]);
  assert.match(client.messages[0].text, /\/poll/);
  assert.doesNotMatch(
    client.messages[0].text,
    /\/zalosay|\/say|\/addme|\/chiateam/
  );
  assert.deepEqual(
    lifecycle.map(([operation]) => operation),
    ['claim', 'complete']
  );
});

test('Zalo webhook application requires production secrets', () => {
  assert.equal(requireEnvironmentValue({ TOKEN: ' value ' }, 'TOKEN'), 'value');
  assert.throws(() => requireEnvironmentValue({}, 'TOKEN'), /Missing TOKEN/);
});

test('managed webhook drains old request before rebuilding and gates polling mode', async () => {
  const {
    createManagedWebhookApplication,
  } = require('./create-zalo-webhook-application');
  let version = 1,
    mode = 'webhook',
    releaseFirst;
  const events = [];
  const firstDone = new Promise(resolve => {
    releaseFirst = resolve;
  });
  const app = createManagedWebhookApplication({
    getSnapshot: async () => ({
      version,
      env: { ZALO_MODE: mode, ZALO_BOT_TOKEN: 'token' },
    }),
    lease: async (_id, action) => {
      events.push(action);
      return { granted: true };
    },
    createApplication: () => {
      const current = version;
      events.push(`create${current}`);
      return {
        client: { getMe: async () => {} },
        handleWebhook: async () => {
          events.push(`start${current}`);
          if (current === 1) await firstDone;
          events.push(`end${current}`);
          return { statusCode: 200, body: { ok: true } };
        },
        stop: async () => events.push(`stop${current}`),
      };
    },
  });
  const first = app.handleWebhook({});
  await new Promise(resolve => setImmediate(resolve));
  version = 2;
  const second = app.handleWebhook({});
  releaseFirst();
  await Promise.all([first, second]);
  assert.ok(events.indexOf('end1') < events.indexOf('stop1'));
  assert.ok(events.indexOf('stop1') < events.indexOf('create2'));
  assert.equal(events.filter(x => x === 'release').length, 2);
  mode = 'polling';
  assert.equal((await app.handleWebhook({})).statusCode, 503);
  await app.stop();
});

test('lease loss fences late custom provider side effects', async () => {
  let release;
  const wait = new Promise(resolve => {
    release = resolve;
  });
  let sends = 0;
  let renewals = 0;
  const app =
    require('./create-zalo-webhook-application').createManagedWebhookApplication(
      {
        getSnapshot: async () => ({
          version: 1,
          env: { ZALO_MODE: 'webhook', ZALO_BOT_TOKEN: 'token' },
        }),
        lease: async (_id, action) =>
          action === 'acquire'
            ? { granted: true, expiresAt: Date.now() + 10000 }
            : (++renewals, { granted: false }),
        createApplication: ({ leaseGuard }) => ({
          client: { getMe: async () => {} },
          handleWebhook: async () => {
            await wait;
            await leaseGuard();
            sends += 1;
            return { statusCode: 200, body: { ok: true } };
          },
          stop: async () => {},
        }),
      }
    );
  const pending = app.handleWebhook({});
  await new Promise(resolve => setImmediate(resolve));
  release();
  const response = await pending;
  assert.equal(response.statusCode, 503);
  assert.equal(sends, 0);
  assert.ok(renewals >= 1);
  await app.stop();
});

test('default webhook client refuses an outbound send after its lease guard fails', async () => {
  let allowed = true;
  const client = new MockZaloClient();
  const app = createZaloWebhookApplication({
    client,
    secretToken: 'fake-secret',
    leaseGuard: async () => {
      if (!allowed)
        throw Object.assign(new Error('LEASE_LOST'), { code: 'LEASE_LOST' });
    },
  });
  await app.client.sendMessage('fake-chat', 'first');
  allowed = false;
  await assert.rejects(app.client.sendMessage('fake-chat', 'late'), {
    code: 'LEASE_LOST',
  });
  assert.equal(client.messages.length, 1);
  await app.stop();
});
test('webhook lease errors block a late handler even with ISO expiry values', async () => {
  const {
    createManagedWebhookApplication,
  } = require('./create-zalo-webhook-application');
  let unblock;
  const wait = new Promise(resolve => {
    unblock = resolve;
  });
  let sent = false;
  const app = createManagedWebhookApplication({
    getSnapshot: async () => ({
      version: 1,
      env: { ZALO_MODE: 'webhook', ZALO_BOT_TOKEN: 'fake' },
    }),
    lease: async (_id, action) => {
      if (action === 'acquire')
        return {
          granted: true,
          expiresAt: new Date(Date.now() + 30000).toISOString(),
        };
      if (action === 'renew') throw new Error('offline');
      return { granted: true };
    },
    createApplication: ({ leaseGuard }) => ({
      client: { getMe: async () => {} },
      stop: async () => {},
      handleWebhook: async () => {
        await wait;
        await leaseGuard();
        sent = true;
        return { statusCode: 200 };
      },
    }),
  });
  const result = app.handleWebhook({});
  await new Promise(resolve => setImmediate(resolve));
  unblock();
  assert.equal((await result).statusCode, 503);
  assert.equal(sent, false);
  await app.stop();
});
