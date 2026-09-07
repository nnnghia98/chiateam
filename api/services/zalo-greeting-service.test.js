const test = require('node:test');
const assert = require('node:assert/strict');
const { createZaloGreetingService } = require('./zalo-greeting-service');

test('greeting claims require valid private identities and ignore subscription fields', async () => {
  const calls = [];
  const service = createZaloGreetingService({
    repository: {
      claim: async identity => {
        calls.push(identity);
        return true;
      },
    },
  });
  const identity = { userId: 'u', chatId: 'c', chatType: 'private' };
  for (const payload of [
    null,
    {},
    { ...identity, chatType: 'group' },
    { ...identity, userId: '' },
    { ...identity, userId: 'a b' },
    { ...identity, chatId: 'c'.repeat(257) },
    { ...identity, chatId: 'c\u0000' },
  ]) {
    assert.deepEqual(await service.claim(payload), {
      ok: false,
      code: 'INVALID_GREETING_REQUEST',
    });
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(
    await service.claim({
      ...identity,
      subscribed: true,
      displayName: 'Unused',
    }),
    { ok: true, claimed: true }
  );
  assert.deepEqual(calls, [{ userId: 'u', chatId: 'c' }]);
});
