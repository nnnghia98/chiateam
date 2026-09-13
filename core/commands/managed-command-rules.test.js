const test = require('node:test');
const assert = require('node:assert/strict');
const { createManagedCommandRules } = require('./managed-command-rules');
const { createCommandRouter } = require('./command-router');
const { createCommandRegistry } = require('./command-registry');
const { createStateRepository } = require('../ports/state-repository');
const { createPermissionPolicy } = require('../ports/permission-policy');
const { buildZaloGreeting } = require('../use-cases/common/zalo-greeting');
function context(platform = 'telegram') { return { command: 'alias', args: [], actor: { platform, externalId: '1' }, conversation: { externalId: '2' } }; }
function fixture(env, permission = 'player') {
  const calls = { load: 0, action: 0, permission: [] };
  const router = createCommandRouter({
    registry: createCommandRegistry([{ name: 'team', aliases: ['alias'], instruction: { usage: '/team', description: 'Team', permission }, stateKeys: ['team'], condition: async () => ({ ok: true }), action: async () => { calls.action++; return { changed: false }; }, reply: async () => ({ messages: [{ text: 'Reply' }] }) }]),
    stateRepository: createStateRepository({ load: async () => { calls.load++; return {}; }, save: async () => {} }),
    permissionPolicy: createPermissionPolicy({ isAllowed: async (_, required) => { calls.permission.push(required); return required !== 'admin'; } }),
    commandRules: createManagedCommandRules(env),
  });
  return { router, calls };
}
test('disabled rule covers aliases and stops before state reads and actions', async () => {
  const { router, calls } = fixture({ TELEGRAM_COMMAND_RULES: '{"team":{"enabled":false}}' });
  assert.match((await router.run(context())).result.messages[0].text, /paused/);
  assert.equal(calls.load, 0); assert.equal(calls.action, 0);
});
test('managed access can tighten but cannot weaken intrinsic admin permission', async () => {
  for (const [intrinsic, configured] of [['player', 'admin'], ['admin', 'player']]) {
    const { router, calls } = fixture({ TELEGRAM_COMMAND_RULES: JSON.stringify({ team: { permission: configured } }) }, intrinsic);
    await router.run(context());
    assert.deepEqual(calls.permission, ['admin']); assert.equal(calls.action, 0);
  }
});
test('malformed rules fail closed but Zalo unsubscribe remains available', () => {
  const rules = createManagedCommandRules({ ZALO_COMMAND_RULES: '{broken' });
  assert.deepEqual(rules(context('zalo'), { name: 'team' }), { enabled: false });
  assert.deepEqual(rules(context('zalo'), { name: 'unsubscribe' }), {});
});
test('custom greeting uses a clean name and keeps a fallback', () => {
  assert.equal(buildZaloGreeting({ displayName: ' A\nB ' }, { ZALO_GREETING_TEXT: 'Hello {name}' }), 'Hello A B');
  assert.match(buildZaloGreeting({}, {}), /ChiaTeam/);
});
