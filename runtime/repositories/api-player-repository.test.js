const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiPlayerRepository } = require('./api-player-repository');

test('API player repository maps a neutral Telegram actor to legacy services', async () => {
  const calls = [];
  const repository = createApiPlayerRepository({
    async registerSelf(input) {
      calls.push(['registerSelf', input]);
      return { ok: true };
    },
    async registerOther(input) {
      calls.push(['registerOther', input]);
      return { ok: true };
    },
    async removeByNumber(number) {
      calls.push(['remove', number]);
      return { ok: true };
    },
    async getByUserId(userId) {
      calls.push(['getByUserId', userId]);
      return { number: 10 };
    },
    async getByNumber(number) {
      calls.push(['getByNumber', number]);
      return { number };
    },
    async getAll() {
      calls.push(['getAll']);
      return [];
    },
  });
  const actor = {
    platform: 'telegram',
    externalId: '123',
    displayName: 'Nghia Nguyen',
    username: 'nghia',
  };

  await repository.registerActor(actor, 10);
  await repository.registerGuest('Minh', 11);
  await repository.deleteByNumber(12);
  await repository.findByActor(actor);
  await repository.findByNumber(13);
  await repository.list();

  assert.deepEqual(calls, [
    [
      'registerSelf',
      {
        teleUser: {
          id: 123,
          first_name: 'Nghia Nguyen',
          username: 'nghia',
        },
        number: 10,
      },
    ],
    ['registerOther', { name: 'Minh', number: 11 }],
    ['remove', 12],
    ['getByUserId', 123],
    ['getByNumber', 13],
    ['getAll'],
  ]);
});

test('API player repository rejects unsupported actor identity mapping', async () => {
  let called = false;
  const repository = createApiPlayerRepository({
    async registerSelf() {
      called = true;
    },
    async registerOther() {},
    async removeByNumber() {},
    async getByUserId() {
      called = true;
    },
    async getByNumber() {},
    async getAll() {},
  });
  const actor = { platform: 'zalo', externalId: 'abc' };

  assert.deepEqual(await repository.registerActor(actor, 10), {
    ok: false,
    code: 'UNSUPPORTED_PLATFORM',
  });
  assert.equal(await repository.findByActor(actor), null);
  assert.equal(called, false);
});
