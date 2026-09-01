const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createZaloWebhookHandler,
  getHeader,
  getZaloWebhookEventId,
  isValidWebhookSecret,
} = require('./webhook');

function createTextUpdate(messageId = 'message-1') {
  return {
    ok: true,
    result: {
      event_name: 'message.text.received',
      message: {
        from: { id: 'user-1', display_name: 'Nghia' },
        chat: { id: 'chat-1', chat_type: 'PRIVATE' },
        text: '/start',
        message_id: messageId,
      },
    },
  };
}

test('Zalo webhook secret comparison supports case-insensitive headers', () => {
  assert.equal(
    getHeader(
      { 'x-bot-api-secret-token': 'secret-123' },
      'X-Bot-Api-Secret-Token'
    ),
    'secret-123'
  );
  assert.equal(isValidWebhookSecret('secret-123', 'secret-123'), true);
  assert.equal(isValidWebhookSecret('wrong', 'secret-123'), false);
});

test('Zalo webhook rejects bad input before routing updates', async () => {
  const updates = [];
  const handler = createZaloWebhookHandler({
    adapter: {
      async handleUpdate(update) {
        updates.push(update);
      },
    },
    secretToken: 'secret-123',
  });

  assert.deepEqual(
    await handler({
      headers: { 'X-Bot-Api-Secret-Token': 'wrong' },
      body: '{}',
    }),
    { statusCode: 403, body: { ok: false } }
  );
  assert.deepEqual(
    await handler({
      headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
      body: '{bad json',
    }),
    { statusCode: 400, body: { ok: false } }
  );
  assert.deepEqual(
    await handler({
      headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
      body: '',
    }),
    { statusCode: 200, body: { ok: true } }
  );
  assert.deepEqual(updates, [{}]);
});

test('Zalo webhook routes a verified update once', async () => {
  const updates = [];
  const update = { ok: true, result: { event_name: 'message.text.received' } };
  const handler = createZaloWebhookHandler({
    adapter: {
      async handleUpdate(value) {
        updates.push(value);
      },
    },
    secretToken: 'secret-123',
  });

  assert.deepEqual(
    await handler({
      headers: new Headers({
        'X-Bot-Api-Secret-Token': 'secret-123',
      }),
      body: JSON.stringify(update),
    }),
    { statusCode: 200, body: { ok: true } }
  );
  assert.deepEqual(updates, [update]);
});

test('Zalo webhook identifies text messages by chat and message ID', () => {
  assert.equal(
    getZaloWebhookEventId(createTextUpdate()),
    '["chat-1","message-1"]'
  );
  assert.equal(getZaloWebhookEventId({ ok: true, result: {} }), null);
});

test('Zalo webhook completes a durable event claim after routing', async () => {
  const calls = [];
  const update = createTextUpdate();
  const handler = createZaloWebhookHandler({
    adapter: {
      async handleUpdate(value) {
        calls.push(['handle', value]);
      },
    },
    secretToken: 'secret-123',
    eventRepository: {
      async claim(event) {
        calls.push(['claim', event]);
        return { state: 'claimed', claimId: 'claim-1' };
      },
      async complete(event) {
        calls.push(['complete', event]);
        return true;
      },
      async release(event) {
        calls.push(['release', event]);
        return true;
      },
    },
  });

  assert.deepEqual(
    await handler({
      headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
      body: update,
    }),
    { statusCode: 200, body: { ok: true } }
  );
  assert.deepEqual(calls, [
    ['claim', { platform: 'zalo', eventId: '["chat-1","message-1"]' }],
    ['handle', update],
    [
      'complete',
      {
        platform: 'zalo',
        eventId: '["chat-1","message-1"]',
        claimId: 'claim-1',
      },
    ],
  ]);
});

test('Zalo webhook skips completed events and retries active claims', async () => {
  let handled = 0;
  let state = 'completed';
  const handler = createZaloWebhookHandler({
    adapter: {
      async handleUpdate() {
        handled += 1;
      },
    },
    secretToken: 'secret-123',
    eventRepository: {
      async claim() {
        return { state };
      },
      async complete() {
        return true;
      },
      async release() {
        return true;
      },
    },
  });
  const request = {
    headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
    body: createTextUpdate(),
  };

  assert.deepEqual(await handler(request), {
    statusCode: 200,
    body: { ok: true },
  });
  assert.equal(handled, 0);

  state = 'processing';
  assert.deepEqual(await handler(request), {
    statusCode: 503,
    headers: { 'Retry-After': '2' },
    body: { ok: false },
  });
  assert.equal(handled, 0);
});

test('Zalo webhook releases a claim when command processing fails', async () => {
  const released = [];
  const handler = createZaloWebhookHandler({
    adapter: {
      async handleUpdate() {
        throw new Error('command failed');
      },
    },
    secretToken: 'secret-123',
    eventRepository: {
      async claim() {
        return { state: 'claimed', claimId: 'claim-1' };
      },
      async complete() {
        return true;
      },
      async release(event) {
        released.push(event);
        return true;
      },
    },
  });

  await assert.rejects(
    handler({
      headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
      body: createTextUpdate(),
    }),
    /command failed/
  );
  assert.deepEqual(released, [
    {
      platform: 'zalo',
      eventId: '["chat-1","message-1"]',
      claimId: 'claim-1',
    },
  ]);
});
