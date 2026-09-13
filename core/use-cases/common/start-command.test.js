const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { COMMAND_MANIFEST } = require('../../commands/command-manifest');
const { createStateRepository } = require('../../ports/state-repository');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const { createStartCommand } = require('./start-command');

const actor = {
  platform: 'telegram',
  externalId: '123',
  displayName: 'Nghia',
};

function context() {
  return {
    command: 'start',
    args: [],
    actor,
    conversation: { externalId: '456' },
  };
}

test('independent /start generates help from the supported manifest', async () => {
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({ commandRules: () => ({}) }),
    ]),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return {};
      },
      async save() {
        throw new Error('/start must not save');
      },
    }),
    commandRules: () => ({}),
  });

  const routed = await router.run({
    command: 'start',
    args: ['telegram-deep-link-payload'],
    actor,
    conversation: { externalId: '456', threadId: null },
  });
  const message = routed.result.messages[0];

  COMMAND_MANIFEST.forEach(entry => {
    assert.match(
      message.text,
      new RegExp(entry.usage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  });
  assert.match(message.text, /\(hoặc \/mf\)/);
  assert.equal(message.channel, 'source');
  assert.equal(message.segments[0].bold, true);
  assert.equal(loadCount, 0);
});

test('filters paused commands, renders quick commands once, and groups categories once', async () => {
  const manifest = [
    {
      name: 'start',
      category: 'Start',
      usage: '/start',
      description: 'help',
      permission: 'player',
    },
    {
      name: 'team',
      category: 'Team',
      usage: '/team [2|3]',
      description: 'view team',
      permission: 'player',
    },
    {
      name: 'paused',
      category: 'Bench',
      usage: '/paused',
      description: 'hidden',
      permission: 'player',
      aliases: ['p'],
    },
    {
      name: 'addme',
      category: 'Bench',
      usage: '/addme',
      description: 'join bench',
      permission: 'player',
    },
    {
      name: 'again',
      category: 'Team',
      usage: '/again',
      description: 'another team',
      permission: 'player',
    },
    {
      name: 'chiateam',
      category: 'Team',
      usage: '/chiateam [2|3]',
      description: 'split team',
      permission: 'player',
    },
    {
      name: 'bench',
      category: 'Bench',
      usage: '/bench',
      description: 'view bench',
      permission: 'player',
    },
  ];
  const commandRules = (_context, entry) =>
    entry.name === 'paused' ? { enabled: false } : {};
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({ manifest, commandRules }),
    ]),
    stateRepository: createStateRepository({
      async load() {
        throw new Error('must not load');
      },
      async save() {
        throw new Error('must not save');
      },
    }),
    commandRules: () => ({}),
  });

  const message = (await router.run(context())).result.messages[0];
  assert.equal(message.channel, 'source');
  assert.doesNotMatch(message.text, /paused|\/p/);
  assert.equal((message.text.match(/\/team \[2\|3\]/g) || []).length, 1);
  assert.equal((message.text.match(/\/addme/g) || []).length, 1);
  assert.equal((message.text.match(/\n⚽ TEAM\n/g) || []).length, 1);
  assert.match(message.text, /🚀 BẮT ĐẦU NHANH/);
  assert.match(message.text, /📚 DANH SÁCH LỆNH/);
  assert.match(message.text, /\/chiateam \[2\|3\] — split team/);
});

test('managed admin override shows admin label while intrinsic admin stays protected', async () => {
  const manifest = [
    {
      name: 'start',
      category: 'Start',
      usage: '/start',
      description: 'help',
      permission: 'player',
    },
    {
      name: 'player-rule',
      category: 'A',
      usage: '/player-rule',
      description: 'rule',
      permission: 'player',
    },
    {
      name: 'intrinsic-admin',
      category: 'A',
      usage: '/intrinsic-admin',
      description: 'admin',
      permission: 'admin',
    },
  ];
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({
        manifest,
        commandRules: (_context, entry) =>
          entry.name === 'player-rule'
            ? { permission: 'admin' }
            : entry.name === 'intrinsic-admin'
              ? { permission: 'player' }
              : {},
        getGreeting: actorValue => `Xin chào ${actorValue.displayName}`,
      }),
    ]),
    stateRepository: createStateRepository({
      async load() {
        return {};
      },
      async save() {},
    }),
    commandRules: () => ({}),
  });
  const message = (await router.run(context())).result.messages[0];
  assert.match(message.text, /^Xin chào Nghia/);
  assert.match(message.text, /\/player-rule — rule \(admin\)/);
  assert.match(message.text, /\/intrinsic-admin — admin \(admin\)/);
});

test('permission denial returns short Vietnamese source reply without state access', async () => {
  let loadCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({ commandRules: () => ({ permission: 'admin' }) }),
    ]),
    permissionPolicy: createPermissionPolicy({ isAllowed: async () => false }),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return {};
      },
      async save() {
        throw new Error('must not save');
      },
    }),
    commandRules: () => ({}),
  });
  const message = (await router.run(context())).result.messages[0];
  assert.equal(message.text, 'Bạn không có quyền thực hiện lệnh này.');
  assert.equal(message.channel, 'source');
  assert.equal(message.segments.length, 0);
  assert.equal(loadCount, 0);
});

test('empty visible manifest keeps a useful default greeting and empty-state message', async () => {
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({ manifest: [], commandRules: () => ({}) }),
    ]),
    stateRepository: createStateRepository({
      async load() {
        return {};
      },
      async save() {},
    }),
    commandRules: () => ({}),
  });
  const message = (await router.run(context())).result.messages[0];
  assert.match(message.text, /^👋 CHIATEAM BOT/);
  assert.match(message.text, /Hiện chưa có lệnh nào khả dụng\./);
});

test('compact help never invents quick-start commands from a tiny manifest', async () => {
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({
        manifest: [
          {
            name: 'poll',
            category: 'Vote',
            usage: '/poll',
            description: 'poll',
            permission: 'player',
          },
        ],
        includeQuickStart: false,
        getGreeting: () => ' ',
        commandRules: () => ({}),
      }),
    ]),
    commandRules: () => ({}),
    stateRepository: createStateRepository({
      async load() {
        return {};
      },
      async save() {},
    }),
  });
  const message = (await router.run(context())).result.messages[0];
  assert.match(message.text, /^👋 CHIATEAM BOT/);
  assert.match(message.text, /\/poll/);
  assert.doesNotMatch(
    message.text,
    /BẮT ĐẦU NHANH|DANH SÁCH LỆNH|\/addme|\/bench/
  );
});

test('help uses a fallback icon for an unknown category', async () => {
  const router = createCommandRouter({
    registry: createCommandRegistry([
      createStartCommand({
        manifest: [
          {
            name: 'mystery',
            category: 'New category',
            usage: '/mystery',
            description: 'mystery command',
            permission: 'player',
          },
        ],
        includeQuickStart: false,
        commandRules: () => ({}),
      }),
    ]),
    commandRules: () => ({}),
    stateRepository: createStateRepository({
      async load() {
        return {};
      },
      async save() {},
    }),
  });

  const message = (await router.run(context())).result.messages[0];
  assert.match(message.text, /📋 NEW CATEGORY/);
});
