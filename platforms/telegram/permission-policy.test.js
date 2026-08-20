const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTelegramPermissionPolicy,
  parseAdminIds,
} = require('./permission-policy');

function createContext(externalId, platform = 'telegram') {
  return {
    actor: { platform, externalId: String(externalId) },
  };
}

test('Telegram permission policy allows configured owner and admins', async () => {
  const policy = createTelegramPermissionPolicy({
    env: {
      BOT_OWNER_ID: '1',
      BOT_ADMIN_IDS: '2, 3',
    },
  });

  assert.equal(await policy.isAllowed(createContext(1), 'admin'), true);
  assert.equal(await policy.isAllowed(createContext(2), 'admin'), true);
  assert.equal(await policy.isAllowed(createContext(4), 'admin'), false);
  assert.equal(await policy.isAllowed(createContext(4), 'player'), true);
  assert.equal(await policy.isAllowed(createContext(1), 'system'), false);
  assert.equal(
    await policy.isAllowed(createContext(1, 'zalo'), 'admin'),
    false
  );
});

test('Telegram permission policy trims and removes empty admin IDs', () => {
  assert.deepEqual(
    parseAdminIds({ BOT_OWNER_ID: '', BOT_ADMIN_IDS: ' 2, ,3 ' }),
    new Set(['2', '3'])
  );
});
