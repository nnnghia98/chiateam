const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createZaloPermissionPolicy,
  parseZaloAdminIds,
} = require('./permission-policy');

function createContext(platform, externalId) {
  return {
    actor: { platform, externalId },
  };
}

test('Zalo permission policy parses owner and admin IDs', () => {
  assert.deepEqual(
    [
      ...parseZaloAdminIds({
        ZALO_BOT_OWNER_ID: 'owner',
        ZALO_BOT_ADMIN_IDS: ' admin-1,admin-2 ',
      }),
    ],
    ['owner', 'admin-1', 'admin-2']
  );
});

test('Zalo permission policy allows players and limits admin commands', async () => {
  const policy = createZaloPermissionPolicy({
    env: {
      ZALO_BOT_OWNER_ID: 'owner',
      ZALO_BOT_ADMIN_IDS: 'admin-1',
    },
  });

  assert.equal(
    await policy.isAllowed(createContext('zalo', 'guest'), 'player'),
    true
  );
  assert.equal(
    await policy.isAllowed(createContext('zalo', 'owner'), 'admin'),
    true
  );
  assert.equal(
    await policy.isAllowed(createContext('zalo', 'admin-1'), 'admin'),
    true
  );
  assert.equal(
    await policy.isAllowed(createContext('zalo', 'guest'), 'admin'),
    false
  );
  assert.equal(
    await policy.isAllowed(createContext('telegram', 'owner'), 'admin'),
    false
  );
});
