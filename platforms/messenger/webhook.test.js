const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const {
  createMessengerWebhookHandler,
  getMessengerEventId,
  isValidMessengerSignature,
  normalizeRawBody,
  verifyMessengerWebhook,
} = require('./webhook');

const secret = 'app-secret';
function signed(body) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}
function payload() {
  return {
    object: 'page',
    entry: [
      {
        id: 'page-1',
        time: 10,
        messaging: [
          {
            sender: { id: 'user-1' },
            recipient: { id: 'page-1' },
            timestamp: 11,
            message: { mid: 'mid-1', text: 'hello' },
          },
          {
            sender: { id: 'user-2' },
            recipient: { id: 'page-1' },
            timestamp: 12,
            delivery: { mids: ['mid-0'] },
          },
          {
            sender: { id: 'user-1' },
            recipient: { id: 'page-1' },
            timestamp: 13,
            message: { mid: 'mid-2', text: 'world' },
          },
        ],
      },
    ],
  };
}

test('Messenger GET verification echoes challenge only for subscribe and matching token', () => {
  assert.deepEqual(
    verifyMessengerWebhook({
      mode: 'subscribe',
      verifyToken: 'token',
      challenge: 'abc',
      expectedToken: 'token',
    }),
    { statusCode: 200, body: 'abc' }
  );
  assert.equal(
    verifyMessengerWebhook({
      mode: 'subscribe',
      verifyToken: 'bad',
      challenge: 'abc',
      expectedToken: 'token',
    }).statusCode,
    403
  );
  assert.equal(
    verifyMessengerWebhook({
      mode: 'subscribe',
      verifyToken: '',
      challenge: 'abc',
      expectedToken: '',
    }).statusCode,
    403
  );
  assert.equal(
    verifyMessengerWebhook({
      mode: 'subscribe',
      verifyToken: 'token',
      challenge: '',
      expectedToken: 'token',
    }).statusCode,
    403
  );
});

test('Messenger signature uses raw bytes and rejects malformed signatures', () => {
  const raw = Buffer.from('{"b":2,"a":1}');
  assert.equal(isValidMessengerSignature(raw, signed(raw), secret), true);
  assert.equal(
    isValidMessengerSignature(
      Buffer.from('{"a":1,"b":2}'),
      signed(raw),
      secret
    ),
    false
  );
  assert.equal(isValidMessengerSignature(raw, 'sha256=bad', secret), false);
});

test('Messenger raw body accepts ArrayBuffer and typed-array input', () => {
  const bytes = Uint8Array.from([65, 66, 67]);

  assert.equal(normalizeRawBody(bytes.buffer).toString('utf8'), 'ABC');
  assert.equal(normalizeRawBody(bytes.subarray(1)).toString('utf8'), 'BC');
});

test('Messenger webhook flattens all message events and ignores non-message events', async () => {
  const received = [];
  const handler = createMessengerWebhookHandler({
    appSecret: secret,
    adapter: {
      async handleUpdate(event) {
        received.push(event);
      },
    },
  });
  const raw = JSON.stringify(payload());
  assert.deepEqual(
    await handler({
      headers: { 'x-hub-signature-256': signed(raw) },
      body: raw,
    }),
    { statusCode: 200, body: { ok: true } }
  );
  assert.deepEqual(
    received.map(event => event.message.mid),
    ['mid-1', 'mid-2']
  );
  assert.equal(getMessengerEventId(received[0]), '["page-1","user-1","mid-1"]');
});

test('Messenger webhook rejects bad signatures and malformed JSON', async () => {
  const handler = createMessengerWebhookHandler({
    appSecret: secret,
    adapter: { async handleUpdate() {} },
  });
  const malformed = '{bad json';

  assert.deepEqual(
    await handler({
      headers: { 'X-Hub-Signature-256': 'sha256=bad' },
      body: '{}',
    }),
    { statusCode: 401, body: { ok: false } }
  );
  assert.deepEqual(
    await handler({
      headers: { 'X-Hub-Signature-256': signed(malformed) },
      body: malformed,
    }),
    { statusCode: 400, body: { ok: false } }
  );
});

test('Messenger webhook claims, completes, skips completed, and returns retry for processing', async () => {
  const calls = [];
  let state = 'claimed';
  const repository = {
    async claim(event) {
      calls.push(['claim', event]);
      return state === 'completed' ? { state } : { state, claimId: 'claim-1' };
    },
    async complete(event) {
      calls.push(['complete', event]);
      return true;
    },
    async release(event) {
      calls.push(['release', event]);
      return true;
    },
  };
  const handler = createMessengerWebhookHandler({
    appSecret: secret,
    eventRepository: repository,
    adapter: {
      async handleUpdate(event) {
        calls.push(['handle', event.message.mid]);
      },
    },
  });
  const raw = JSON.stringify(payload());
  const request = {
    headers: { 'X-Hub-Signature-256': signed(raw) },
    body: raw,
  };
  assert.equal((await handler(request)).statusCode, 200);
  state = 'completed';
  assert.equal((await handler(request)).statusCode, 200);
  state = 'processing';
  assert.deepEqual(await handler(request), {
    statusCode: 503,
    headers: { 'Retry-After': '2' },
    body: { ok: false },
  });
  assert.equal(calls.filter(call => call[0] === 'handle').length, 2);
});

test('Messenger webhook releases claim when processing fails', async () => {
  const released = [];
  const handler = createMessengerWebhookHandler({
    appSecret: secret,
    eventRepository: {
      async claim() {
        return { state: 'claimed', claimId: 'claim-1' };
      },
      async complete() {
        return true;
      },
      async release(event) {
        released.push(event);
      },
    },
    adapter: {
      async handleUpdate() {
        throw new Error('failed');
      },
    },
  });
  const raw = JSON.stringify(payload());
  await assert.rejects(
    handler({ headers: { 'X-Hub-Signature-256': signed(raw) }, body: raw }),
    /failed/
  );
  assert.deepEqual(released, [
    {
      platform: 'messenger',
      eventId: '["page-1","user-1","mid-1"]',
      claimId: 'claim-1',
    },
  ]);
});
