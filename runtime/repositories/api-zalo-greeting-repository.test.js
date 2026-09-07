const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createApiZaloGreetingRepository,
} = require('./api-zalo-greeting-repository');

test('greeting API requests are bounded and malformed responses cannot trigger greetings', async () => {
  const identity = { userId: 'u', chatId: 'c', chatType: 'private' };
  for (const claimed of [true, false]) {
    const repository = createApiZaloGreetingRepository({
      request: async (path, options) => {
        assert.equal(path, '/api/zalo-greetings/claim');
        assert.deepEqual(options, {
          method: 'POST',
          body: identity,
          timeoutMs: 2000,
        });
        return { ok: true, claimed };
      },
    });
    assert.equal(await repository.claim(identity), claimed);
  }
  for (const result of [
    null,
    {},
    { ok: false, claimed: true },
    { ok: true, claimed: 'true' },
  ]) {
    const repository = createApiZaloGreetingRepository({
      request: async () => result,
    });
    await assert.rejects(
      repository.claim(identity),
      /Invalid Zalo greeting API response/
    );
  }
});
