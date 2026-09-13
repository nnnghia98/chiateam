const test = require('node:test');
const assert = require('node:assert/strict');
const { testConnections } = require('./provider-tests');
const { runManagementOperation } = require('./operations');
const {
  createZaloAnnouncementService,
} = require('../services/zalo-announcement-service');

function fakeResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('provider checks use fixed provider endpoints and never send messages', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/getMe'))
      return fakeResponse({ ok: true, result: { id: '1', username: 'bot' } });
    return fakeResponse({ ok: true, result: {} });
  };
  const result = await testConnections('zalo', {
    env: { ZALO_BOT_TOKEN: 'candidate' },
    fetchImpl,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.match(
    calls[0].url,
    /^https:\/\/bot-api\.zaloplatforms\.com\/botcandidate\/getMe$/
  );
  assert.ok(calls.every(call => call.options.redirect === 'error'));
  assert.ok(calls.every(call => !call.url.includes('send')));
});

test('provider checks reject destinations outside the explicit allowlist', async () => {
  const result = await testConnections('api', {
    env: {
      MANAGEMENT_API_URL: 'https://attacker.example',
      MANAGEMENT_ALLOWED_ORIGINS: 'https://api.example',
    },
    fetchImpl: async () => {
      throw new Error('must not call');
    },
  });
  assert.deepEqual(
    { ok: result.ok, errorCode: result.errorCode },
    { ok: false, errorCode: 'DESTINATION_NOT_ALLOWED' }
  );
});

test('webhook removal requires confirmation and subscriber removal keeps opt-out state', async () => {
  const calls = [];
  const repository = {
    removeSubscriber: async input => {
      calls.push(input);
      return { subscribed: false };
    },
  };
  const zalo = {
    deleteWebhook: async () => {
      throw new Error('must not call');
    },
  };
  const denied = await runManagementOperation(
    'webhook-remove',
    {},
    { actor: { sessionId: 's' }, providers: { zalo } }
  );
  assert.equal(denied.code, 'CONFIRM_REQUIRED');
  const result = await runManagementOperation(
    'subscriber-remove',
    { userId: 'u', confirm: true },
    { actor: { sessionId: 's' }, repository }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(calls[0], {
    chatId: 'admin:u',
    userId: 'u',
    subscribed: false,
  });
});

test('announcement send claims, sends, records and returns delivery results', async () => {
  const events = [];
  let used = false;
  const service = {
    claim: async input => {
      events.push(['claim', input]);
      return { id: 'a', message: 'hi' };
    },
    next: async () => {
      if (used) return null;
      used = true;
      return { chatId: 'c' };
    },
    status: async () => ({ pending: 0 }),
    record: async input => events.push(['record', input]),
    finish: async input => events.push(['finish', input]),
  };
  const result = await runManagementOperation(
    'announcement-send',
    { id: 'a', confirm: true },
    {
      actor: { id: 'admin' },
      announcementService: service,
      providers: { sendAnnouncementDelivery: async () => ({ messageId: 'm' }) },
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.result.deliveries[0].status, 'sent');
  assert.equal(events[1][0], 'record');
  assert.equal(events.at(-1)[0], 'finish');
});

test('webhook mutations require proof that polling stopped and its lease is gone', async () => {
  let called = false;
  const result = await runManagementOperation(
    'webhook-remove',
    { confirm: true },
    {
      actor: { id: 'admin' },
      providers: {
        zalo: {
          deleteWebhook: async () => {
            called = true;
          },
        },
      },
      quiesce: async () => ({ stopped: true, leaseGone: false }),
    }
  );
  assert.equal(result.code, 'POLLING_QUIESCE_REQUIRED');
  assert.equal(called, false);
  const removed = await runManagementOperation(
    'webhook-remove',
    { confirm: true },
    {
      actor: { id: 'admin' },
      providers: {
        zalo: {
          deleteWebhook: async () => {
            called = true;
          },
        },
      },
      quiesce: async () => ({ stopped: true, leaseGone: true }),
    }
  );
  assert.equal(removed.ok, true);
  assert.equal(called, true);
});

test('management preview binds the real announcement service to Telegram source ownership', async () => {
  let prepared;
  const service = createZaloAnnouncementService({
    createId: () => '11111111-1111-4111-8111-111111111111',
    repository: {
      prepare: async value => ((prepared = value), { id: value.id, total: 3 }),
    },
  });
  const result = await runManagementOperation(
    'announcement-preview',
    {
      message: 'hello',
      platform: 'zalo',
      sourceChatId: 'spoofed',
      sourceThreadId: 'spoofed',
    },
    { actor: { id: 'admin' }, announcementService: service }
  );
  assert.equal(result.ok, true);
  assert.equal(prepared.sourceChatId, 'management');
  assert.equal(prepared.sourceThreadId, '');
  assert.equal(result.result.subscriberCount, 3);
});

test('ambiguous delivery is recorded as unknown and prevents premature finish', async () => {
  const events = [];
  let used = false;
  const service = {
    claim: async () => ({ id: 'a', message: 'hi' }),
    next: async () => (used ? null : ((used = true), { chatId: 'c' })),
    status: async () => ({
      total: 1,
      pending: 0,
      uncertain: 1,
      sent: 0,
      failed: 0,
      skipped: 0,
    }),
    record: async input => events.push(input),
    finish: async () => {
      throw new Error('must not finish');
    },
  };
  const result = await runManagementOperation(
    'announcement-send',
    { id: 'a', confirm: true },
    {
      actor: { id: 'admin' },
      announcementService: service,
      providers: {
        sendAnnouncementDelivery: async () => {
          throw Object.assign(new Error('network'), { code: 'NETWORK_ERROR' });
        },
      },
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.result.counts.uncertain, 1);
  assert.deepEqual(events[0], {
    id: 'a',
    chatId: 'c',
    status: 'unknown',
    errorCode: 'SEND_UNKNOWN',
  });
});

test('expired announcement draft cannot fall back to a successful send', async () => {
  const {
    createZaloAnnouncementService,
  } = require('../services/zalo-announcement-service');
  let nextCalls = 0;
  const repository = {
    claim: async () => null,
    content: async () => ({ id: '123', status: 'draft' }),
    next: async () => {
      nextCalls++;
      return null;
    },
  };
  const service = createZaloAnnouncementService({ repository });
  const result = await runManagementOperation(
    'announcement-send',
    { id: '123', confirm: true },
    { actor: { id: 'admin' }, repository, announcementService: service }
  );
  assert.equal(result.ok, false);
  assert.equal(nextCalls, 0);
});
