const test = require('node:test');
const assert = require('node:assert/strict');
const { createZaloBroadcastService } = require('./broadcast-service');

const id = '11111111-1111-4111-8111-111111111111';
const context = {
  actor: { platform: 'telegram', externalId: 'admin' },
  conversation: { externalId: 'source' },
};

function harness({ send, getMe, record, env, client: useClient = true } = {}) {
  const sent = [],
    records = [],
    diagnostics = [],
    waits = [];
  let claimed = false,
    finished = false;
  const recipients = ['a', 'b'];
  const repository = {
    prepare: async () => ({ id, total: 2 }),
    claim: async () => {
      if (claimed) return null;
      claimed = true;
      return { id, message: 'Hello' };
    },
    next: async () =>
      recipients.length ? { chatId: recipients.shift() } : null,
    record:
      record ||
      (async r => {
        records.push(r);
        return true;
      }),
    finish: async () => {
      finished = true;
    },
    status: async () => ({ id, status: finished ? 'finished' : 'sending' }),
    cancel: async () => true,
  };
  const client = {
    getMe: getMe || (async () => ({})),
    sendMessage: async (chatId, message) => {
      sent.push([chatId, message]);
      if (send) await send(chatId);
    },
  };
  const service = createZaloBroadcastService({
    repository,
    env: env || {},
    ...(useClient ? { client } : {}),
    wait: async ms => waits.push(ms),
    onDiagnostic: d => diagnostics.push(d),
  });
  return {
    service,
    repository,
    sent,
    records,
    diagnostics,
    waits,
    remaining: recipients,
  };
}

test('broadcast sends each recipient once, paces delivery and ignores repeated confirmation', async () => {
  const h = harness();
  await h.service.prepare('Hello', context);
  assert.equal(h.sent.length, 0);
  const results = await Promise.all([
    h.service.confirm(id, context),
    h.service.confirm(id, context),
  ]);
  assert.deepEqual(results.map(r => r.code).sort(), [
    'FINISHED',
    'UNAVAILABLE',
  ]);
  assert.deepEqual(h.sent, [
    ['a', 'Hello'],
    ['b', 'Hello'],
  ]);
  assert.ok(h.records.every(r => r.status === 'sent'));
  assert.ok(h.waits.every(ms => ms === 1000));
});

test('invalid or missing token cannot consume a draft or send to anyone', async () => {
  const error = Object.assign(new Error('sensitive token'), {
    name: 'ZaloApiError',
    statusCode: 200,
    errorCode: 401,
  });
  const invalid = harness({
    getMe: async () => {
      throw error;
    },
  });
  assert.equal(
    (await invalid.service.confirm(id, context)).code,
    'UNAUTHORIZED'
  );
  assert.equal(invalid.sent.length, 0);
  assert.doesNotMatch(JSON.stringify(invalid.diagnostics), /sensitive token/);
  const missing = harness({ client: false });
  assert.equal(
    (await missing.service.confirm(id, context)).code,
    'MISSING_TOKEN'
  );
  assert.equal(missing.sent.length, 0);
});

test('a recipient rejection does not hide successful deliveries to others', async () => {
  const h = harness({
    send: async chat => {
      if (chat === 'a')
        throw Object.assign(new Error('private error'), {
          name: 'ZaloApiError',
          statusCode: 403,
          errorCode: 403,
        });
    },
  });
  assert.equal((await h.service.confirm(id, context)).code, 'FINISHED');
  assert.deepEqual(
    h.records.map(r => r.status),
    ['failed', 'sent']
  );
});

test('rate limits and uncertain network results stop without automatic retries', async () => {
  for (const [error, category, status] of [
    [
      Object.assign(new Error('token-in-url'), {
        name: 'ZaloApiError',
        errorCode: 429,
        statusCode: 200,
      }),
      'RATE_LIMITED',
      'failed',
    ],
    [new TypeError('fetch failed secret-url'), 'NETWORK_ERROR', 'unknown'],
    ...[
      { statusCode: 503, errorCode: null },
      { statusCode: 200, errorCode: 500 },
      { statusCode: 200, errorCode: null },
    ].map(fields => [
      Object.assign(new Error('Unconfirmed response'), {
        name: 'ZaloApiError',
        ...fields,
      }),
      'NETWORK_ERROR',
      'unknown',
    ]),
  ]) {
    const h = harness({
      send: async () => {
        throw error;
      },
    });
    const result = await h.service.confirm(id, context);
    assert.equal(result.stopReason, category);
    assert.equal(h.sent.length, 1);
    assert.equal(h.remaining.length, 1);
    assert.equal(h.records[0].status, status);
    assert.doesNotMatch(
      JSON.stringify(h.diagnostics),
      /token-in-url|secret-url/
    );
    await h.service.confirm(id, context);
    assert.equal(h.sent.length, 1);
  }
});

test('a lost delivery receipt stops the batch instead of resending', async () => {
  const h = harness({
    record: async () => {
      throw new Error('DB unavailable');
    },
  });
  const result = await h.service.confirm(id, context);
  assert.equal(result.code, 'PROGRESS_UNAVAILABLE');
  assert.equal(result.id, id);
  assert.equal(h.sent.length, 1);
  await h.service.confirm(id, context);
  assert.equal(h.sent.length, 1);
});
