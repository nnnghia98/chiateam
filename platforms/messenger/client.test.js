const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_MESSENGER_GRAPH_API_VERSION,
  MessengerBotClient,
  extractMessengerMessages,
} = require('./client');

function createUpdate(overrides = {}) {
  return {
    object: 'page',
    entry: [
      {
        id: 'page-1',
        messaging: [
          {
            sender: { id: 'user-1' },
            recipient: { id: 'page-1' },
            timestamp: 1,
            message: { mid: 'mid-1', text: 'hello', ...overrides },
          },
        ],
      },
    ],
  };
}

test('Messenger client sends RESPONSE messages with bearer auth', async () => {
  const calls = [];
  const client = new MessengerBotClient({
    pageId: '123456',
    pageAccessToken: 'secret-token',
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'm1' }),
      };
    },
  });

  assert.deepEqual(await client.sendMessage('user-1', 'Hello'), {
    message_id: 'm1',
  });
  assert.equal(
    calls[0].url,
    `https://graph.facebook.com/${DEFAULT_MESSENGER_GRAPH_API_VERSION}/123456/messages`
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    messaging_type: 'RESPONSE',
    recipient: { id: 'user-1' },
    message: { text: 'Hello' },
  });
  assert.doesNotMatch(calls[0].url, /secret-token/);
});

test('Messenger client reports Graph errors without exposing token', async () => {
  const client = new MessengerBotClient({
    pageId: '123456',
    pageAccessToken: 'secret-token',
    fetcher: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad request', code: 100 } }),
    }),
  });

  await assert.rejects(
    () => client.sendMessage('user-1', 'Hello'),
    error => {
      assert.equal(error.name, 'MessengerApiError');
      assert.equal(error.statusCode, 400);
      assert.equal(error.errorCode, 100);
      assert.doesNotMatch(error.stack, /secret-token/);
      return true;
    }
  );
});

test('Messenger client validates IDs, versions, and message length', () => {
  assert.throws(
    () => new MessengerBotClient({ pageId: 'bad', pageAccessToken: 'token' }),
    /page ID is invalid/
  );
  assert.throws(
    () =>
      new MessengerBotClient({
        pageId: '123',
        pageAccessToken: 'token',
        graphApiVersion: 'latest',
      }),
    /version is invalid/
  );
  const client = new MessengerBotClient({
    pageId: '123',
    pageAccessToken: 'token',
  });
  assert.throws(() => client.sendMessage('user', ''), /1 to 2000/);
  assert.throws(
    () => client.sendMessage('user', 'x'.repeat(2001)),
    /1 to 2000/
  );
});

test('Messenger client extracts text messages and ignores echoes/non-text', () => {
  const update = createUpdate();
  update.entry[0].messaging.push(
    {
      sender: { id: 'user-2' },
      recipient: { id: 'page-1' },
      message: { mid: 'echo', text: 'echo', is_echo: true },
    },
    {
      sender: { id: 'user-3' },
      recipient: { id: 'page-1' },
      message: { mid: 'image', attachments: [] },
    }
  );
  assert.equal(extractMessengerMessages(update).length, 1);
  assert.equal(extractMessengerMessages(update)[0].sender.id, 'user-1');
});

test('Messenger client emits update and extracted message events', () => {
  const client = new MessengerBotClient({
    pageId: '123',
    pageAccessToken: 'token',
  });
  const events = [];
  client.on('update', () => events.push('update'));
  client.on('message', message => events.push(`message:${message.mid}`));
  client.processUpdate(createUpdate());
  assert.deepEqual(events, ['update', 'message:mid-1']);
});
