const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMessengerPermissionPolicy,
  parseMessengerAdminIds,
} = require('./permission-policy');

const context = (platform, id) => ({ actor: { platform, externalId: id } });

test('Messenger admin IDs are parsed and trimmed', () => {
  assert.deepEqual(
    [...parseMessengerAdminIds({ MESSENGER_ADMIN_IDS: ' one, two,,one ' })],
    ['one', 'two']
  );
  assert.deepEqual([...parseMessengerAdminIds({})], []);
});

test('Messenger permission allows players and configured admins only', async () => {
  const policy = createMessengerPermissionPolicy({
    env: { MESSENGER_ADMIN_IDS: 'admin-1,admin-2' },
  });
  assert.equal(
    await policy.isAllowed(context('messenger', 'guest'), 'player'),
    true
  );
  assert.equal(
    await policy.isAllowed(context('messenger', 'admin-1'), 'admin'),
    true
  );
  assert.equal(
    await policy.isAllowed(context('messenger', 'guest'), 'admin'),
    false
  );
  assert.equal(
    await policy.isAllowed(context('telegram', 'admin-1'), 'admin'),
    false
  );
});
