const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPlayerRepository } = require('../../ports/player-repository');
const { createStateRepository } = require('../../ports/state-repository');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createMeCommand } = require('./me-command');
const { createRegisterCommand, parseRegisterRequest } = require('./register-command');

function context(command, args = []) {
  return { command, args, actor: { platform: 'telegram', externalId: '123', displayName: 'Nghia Nguyen', username: 'nghia' }, conversation: { externalId: '456', threadId: null } };
}
function router(definitions) {
  return createCommandRouter({ registry: createCommandRegistry(definitions), permissionPolicy: createPermissionPolicy({ isAllowed: async (_context, permission) => permission !== 'admin' }), stateRepository: createStateRepository({ async load() { return {}; }, async save() {} }) });
}
function playersWith(overrides = {}) {
  return createPlayerRepository({
    async registerActor() {}, async registerGuest() {}, async deleteByNumber() {},
    async findByActor() { return null; }, async findByNumber() { return null; }, async list() { return []; },
    ...overrides,
  });
}

test('/register parser accepts player registration actions', () => {
  assert.deepEqual(parseRegisterRequest(['10']), { kind: 'self', number: 10 });
  assert.deepEqual(parseRegisterRequest(['add', 'Minh', '11']), { kind: 'add', name: 'Minh', number: 11 });
  assert.equal(parseRegisterRequest(['bad']), null);
});
test('/me returns identity and shirt number without aggregate statistics', async () => {
  const players = playersWith({ async findByActor() { return { name: 'Nghia', number: 10 }; } });
  const result = await router([createMeCommand({ playerRepository: players })]).run(context('me'));
  assert.match(result.result.messages[0].text, /Số áo: 10/);
  assert.doesNotMatch(result.result.messages[0].text, /Bàn thắng|Kiến tạo|Tỷ lệ thắng/);
});
test('/register keeps self registration available', async () => {
  const players = playersWith({ async registerActor(_actor, number) { return { ok: true, player: { name: 'Nghia', number } }; } });
  const result = await router([createRegisterCommand({ playerRepository: players })]).run(context('register', ['10']));
  assert.match(result.result.messages[0].text, /Đăng ký thành công/);
});
