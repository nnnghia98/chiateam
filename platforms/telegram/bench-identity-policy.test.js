const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTelegramBenchIdentityPolicy,
  parseTelegramUserId,
} = require('./bench-identity-policy');

const ACTOR = Object.freeze({
  platform: 'telegram',
  externalId: '123',
});

test('Telegram bench identity keeps the legacy numeric userId shape', () => {
  const policy = createTelegramBenchIdentityPolicy();

  assert.deepEqual(policy.createEntry(ACTOR, 'Nghia'), [
    123,
    { name: 'Nghia', userId: 123 },
  ]);
  assert.equal(policy.matchesEntry([123, { name: 'Old name' }], ACTOR), true);
  assert.equal(
    policy.matchesEntry([999, { name: 'Nghia', userId: 123 }], ACTOR),
    true
  );
  assert.equal(policy.matchesEntry([999, { name: 'Other' }], ACTOR), false);
});

test('Telegram bench identity preserves external IDs outside safe integer range', () => {
  assert.equal(
    parseTelegramUserId('99999999999999999999'),
    '99999999999999999999'
  );
});
