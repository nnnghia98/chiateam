const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createZaloAnnouncementService,
  normalizeRequest,
} = require('./zalo-announcement-service');

const id = '11111111-1111-4111-8111-111111111111';
const source = {
  platform: 'telegram',
  actorId: 'admin',
  sourceChatId: 'source',
  sourceThreadId: '',
};

test('subscription validation rejects groups, missing identities and extra target changes', () => {
  assert.equal(
    normalizeRequest('subscribe', {
      chatId: 'g',
      userId: 'u',
      chatType: 'group',
    }),
    null
  );
  assert.equal(
    normalizeRequest('subscribe', { chatId: 'c', chatType: 'private' }),
    null
  );
  assert.equal(normalizeRequest('unsubscribe', null), null);
  assert.deepEqual(
    normalizeRequest('unsubscribe', {
      chatId: 'c',
      userId: 'u',
      chatType: 'private',
      subscribed: true,
    }),
    {
      chatId: 'c',
      userId: 'u',
      subscribed: false,
      displayName: null,
    }
  );
});

test('broadcast validation requires Telegram source ownership and bounded content', () => {
  for (const payload of [
    null,
    [],
    {},
    { ...source, message: '' },
    { ...source, message: 'x'.repeat(2001) },
    { ...source, message: 'hello', platform: 'zalo' },
  ]) {
    assert.equal(normalizeRequest('prepare', payload), null);
  }
  assert.equal(normalizeRequest('claim', { ...source, id: 'invalid' }), null);
  assert.equal(
    normalizeRequest('claim', { ...source, id, sourceThreadId: null }),
    null
  );
  assert.deepEqual(normalizeRequest('claim', { ...source, id }), {
    id,
    actorId: 'admin',
    sourceChatId: 'source',
    sourceThreadId: '',
  });
});

test('photo drafts require credential-free HTTPS URLs and allow an empty caption', () => {
  assert.deepEqual(
    normalizeRequest('prepare', { ...source, message: '', photoUrl: 'https://cdn.example/photo.jpg' }),
    { id: undefined, actorId: 'admin', sourceChatId: 'source', sourceThreadId: '', message: '', photoUrl: 'https://cdn.example/photo.jpg' }
  );
  for (const photoUrl of [
    'http://cdn.example/photo.jpg',
    'https://user:pass@cdn.example/photo.jpg',
    'javascript:alert(1)',
    `https://cdn.example/${'x'.repeat(2049)}`,
    123,
  ]) {
    assert.equal(normalizeRequest('prepare', { ...source, message: 'caption', photoUrl }), null);
  }
  assert.equal(
    normalizeRequest('prepare', { ...source, message: 'x'.repeat(2001), photoUrl: 'https://cdn.example/photo.jpg' }),
    null
  );
});

test('delivery receipts accept only safe error categories', () => {
  assert.equal(
    normalizeRequest('record', { id, chatId: 'c', status: 'pending' }),
    null
  );
  assert.equal(
    normalizeRequest('record', {
      id,
      chatId: 'c',
      status: 'failed',
      errorCode: 'raw secret-bearing error',
    }),
    null
  );
  assert.deepEqual(
    normalizeRequest('record', {
      id,
      chatId: 'c',
      status: 'sent',
      errorCode: 'secret',
    }),
    { id, chatId: 'c', status: 'sent', errorCode: null }
  );
});

test('service validates before storage and generates its own draft ID', async () => {
  const calls = [];
  const service = createZaloAnnouncementService({
    createId: () => id,
    repository: {
      async prepare(p) {
        calls.push(p);
        return { id: p.id, total: 2 };
      },
      async setSubscription(p) {
        calls.push(p);
        return { subscribed: p.subscribed };
      },
    },
  });
  assert.equal((await service.prepare({ ...source, message: '' })).ok, false);
  assert.equal(calls.length, 0);
  assert.deepEqual(
    await service.prepare({ ...source, message: 'hello', id: 'caller-id' }),
    { ok: true, result: { id, total: 2 } }
  );
  assert.equal(calls[0].id, id);
  assert.deepEqual(
    await service.subscribe({ chatId: 'c', userId: 'u', chatType: 'private' }),
    { ok: true, result: { subscribed: true } }
  );
});

test('subscriber profiles normalize optional names and cannot change consent', () => {
  const identity = { chatId: 'c', userId: 'u', chatType: 'private' };
  assert.deepEqual(
    normalizeRequest('refreshSubscriber', {
      ...identity,
      displayName: '  Nguyễn\nVăn\u0000 A  ',
      subscribed: true,
    }),
    { chatId: 'c', userId: 'u', displayName: 'Nguyễn Văn A' }
  );
  for (const displayName of [undefined, null, '', ' \n ', {}, 123]) {
    assert.equal(
      normalizeRequest('subscribe', { ...identity, displayName }).displayName,
      null
    );
  }
  assert.equal(
    normalizeRequest('subscribe', { ...identity, displayName: 'a'.repeat(300) })
      .displayName.length,
    256
  );
  assert.equal(
    normalizeRequest('refreshSubscriber', { ...identity, chatType: 'group' }),
    null
  );
  assert.equal(
    normalizeRequest('refreshSubscriber', { ...identity, userId: '' }),
    null
  );
});

test('subscriber list pagination is bounded and ignores caller page sizes', () => {
  assert.deepEqual(normalizeRequest('subscribers', {}), {
    page: 1,
    pageSize: 10,
  });
  assert.deepEqual(
    normalizeRequest('subscribers', { page: 2, pageSize: 1000 }),
    { page: 2, pageSize: 10 }
  );
  for (const page of [0, -1, 1.5, '2', 1000001]) {
    assert.equal(normalizeRequest('subscribers', { page }), null);
  }
});
