const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ZaloBotClient,
  extractZaloMessage,
  normalizeUpdates,
} = require('./client');

function createResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('Zalo client calls the official bot API without exposing its token', async () => {
  const calls = [];
  const client = new ZaloBotClient({
    token: 'test-token',
    async fetcher(url, options) {
      calls.push({ url, options });
      return createResponse({
        ok: true,
        result: { message_id: 'message-1' },
      });
    },
  });

  const result = await client.sendMessage('chat-1', 'Hello', {
    parse_mode: 'markdown',
  });

  assert.deepEqual(result, { message_id: 'message-1' });
  assert.equal(
    calls[0].url,
    'https://bot-api.zaloplatforms.com/bottest-token/sendMessage'
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    chat_id: 'chat-1',
    text: 'Hello',
    parse_mode: 'markdown',
  });

  const failingClient = new ZaloBotClient({
    token: 'private-token',
    async fetcher() {
      return createResponse(
        { ok: false, description: 'Invalid request', error_code: 400 },
        { ok: false, status: 400 }
      );
    },
  });

  await assert.rejects(
    failingClient.getMe(),
    error =>
      error.name === 'ZaloApiError' &&
      error.method === 'getMe' &&
      error.statusCode === 400 &&
      !error.message.includes('private-token')
  );
});

test('Zalo client receives long-poll updates and emits text messages', async () => {
  const update = {
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
  const messages = [];
  const client = new ZaloBotClient({
    token: 'test-token',
    async fetcher(url, options) {
      assert.match(url, /\/getUpdates$/);
      assert.deepEqual(JSON.parse(options.body), { timeout: '30' });
      return createResponse({ ok: true, result: update });
    },
  });

  client.on('message', message => messages.push(message));

  assert.equal(await client.pollOnce(), 1);
  assert.deepEqual(messages, [update.result.message]);
  assert.equal(extractZaloMessage(update), update.result.message);
  assert.deepEqual(normalizeUpdates({ updates: [update] }), [update]);
});

test('Zalo client validates message and webhook limits', () => {
  const client = new ZaloBotClient({
    token: 'test-token',
    fetcher: async () => createResponse({ ok: true, result: {} }),
  });

  assert.throws(() => client.sendMessage('chat-1', ''), /1 to 2000/);
  assert.throws(
    () => client.sendMessage('chat-1', 'x'.repeat(2001)),
    /1 to 2000/
  );
  assert.throws(
    () => client.setWebhook('http://example.com/zalo', '12345678'),
    /HTTPS/
  );
  assert.throws(
    () => client.setWebhook('https://example.com/zalo', 'short'),
    /8 to 256/
  );
});

test('Zalo client exposes webhook status operations', async () => {
  const methods = [];
  const client = new ZaloBotClient({
    token: 'test-token',
    async fetcher(url) {
      methods.push(url.split('/').at(-1));
      return createResponse({ ok: true, result: { ok: true } });
    },
  });

  await client.getWebhookInfo();
  await client.testWebhook();
  await client.deleteWebhook();
  assert.deepEqual(methods, ['getWebhookInfo', 'testWebhook', 'deleteWebhook']);
});
