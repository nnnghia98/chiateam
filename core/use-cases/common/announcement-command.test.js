const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createPermissionPolicy } = require('../../ports/permission-policy');
const {
  createAnnouncementPublisher,
} = require('../../ports/announcement-publisher');
const { createStateRepository } = require('../../ports/state-repository');
const {
  ANNOUNCEMENT_MESSAGES,
  MAX_ANNOUNCEMENT_LENGTH,
  createAnnouncementCommand,
  parseAnnouncementRequest,
} = require('./announcement-command');

function createContext(args = [], command = 'zalosay', platform = 'zalo') {
  return {
    command,
    args,
    actor: {
      platform,
      externalId: 'zalo-admin',
      displayName: 'Admin',
    },
    conversation: { externalId: 'source-chat', threadId: null },
  };
}

function createAnnouncementRouter({ isAdmin = true, publisher } = {}) {
  let loadCount = 0;
  let saveCount = 0;
  const router = createCommandRouter({
    registry: createCommandRegistry([createAnnouncementCommand({ publisher })]),
    permissionPolicy: createPermissionPolicy({
      isAllowed: async (context, permission) =>
        permission !== 'admin' || isAdmin,
    }),
    stateRepository: createStateRepository({
      async load() {
        loadCount += 1;
        return {};
      },
      async save() {
        saveCount += 1;
        return {};
      },
    }),
  });

  return {
    router,
    getLoadCount: () => loadCount,
    getSaveCount: () => saveCount,
  };
}

test('announcement parser accepts a bounded message', () => {
  assert.deepEqual(parseAnnouncementRequest(['Sân', 'A', '20h']), {
    ok: true,
    message: 'Sân A 20h',
  });
  assert.deepEqual(parseAnnouncementRequest([]), {
    ok: false,
    code: 'MISSING_ANNOUNCEMENT',
  });
  assert.deepEqual(
    parseAnnouncementRequest(['x'.repeat(MAX_ANNOUNCEMENT_LENGTH + 1)]),
    { ok: false, code: 'INVALID_ANNOUNCEMENT' }
  );
});

test('admin announcement returns the message on the announcement channel', async () => {
  const { router, getLoadCount, getSaveCount } = createAnnouncementRouter();

  const routed = await router.run(createContext(['Sân', 'A', '20h'], 'say'));

  assert.equal(routed.handled, true);
  assert.equal(routed.command, 'zalosay');
  assert.equal(routed.result.messages[0].text, 'Sân A 20h');
  assert.equal(routed.result.messages[0].channel, 'announcement');
  assert.equal(getLoadCount(), 0);
  assert.equal(getSaveCount(), 0);
});

test('remote announcement publishes to Zalo and confirms in the source chat', async () => {
  const published = [];
  const publisher = createAnnouncementPublisher({
    async publish(message, context) {
      published.push({ message, platform: context.actor.platform });
      return { platform: 'zalo', chatId: 'zalo-chat' };
    },
  });
  const { router, getLoadCount, getSaveCount } = createAnnouncementRouter({
    publisher,
  });

  const routed = await router.run(
    createContext(['Hello', 'Zalo'], 'zalosay', 'telegram')
  );

  assert.deepEqual(published, [
    { message: 'Hello Zalo', platform: 'telegram' },
  ]);
  assert.deepEqual(routed.result.messages[0], {
    text: ANNOUNCEMENT_MESSAGES.success,
    actions: [],
    segments: [],
    channel: 'source',
    input: null,
  });
  assert.equal(getLoadCount(), 0);
  assert.equal(getSaveCount(), 0);
});

test('remote announcement reports a safe source error when Zalo fails', async () => {
  const publisher = createAnnouncementPublisher({
    async publish() {
      throw new Error('private Zalo API failure');
    },
  });
  const { router } = createAnnouncementRouter({ publisher });

  const routed = await router.run(
    createContext(['Hello'], 'zalosay', 'telegram')
  );

  assert.equal(
    routed.result.messages[0].text,
    ANNOUNCEMENT_MESSAGES.publishError
  );
  assert.equal(routed.result.messages[0].channel, 'source');
  assert.doesNotMatch(routed.result.messages[0].text, /private/);
});

test('announcement errors stay in the source chat', async () => {
  const allowed = createAnnouncementRouter();
  const denied = createAnnouncementRouter({ isAdmin: false });

  const missing = await allowed.router.run(createContext());
  const invalid = await allowed.router.run(
    createContext(['x'.repeat(MAX_ANNOUNCEMENT_LENGTH + 1)])
  );
  const forbidden = await denied.router.run(createContext(['Hello']));

  assert.deepEqual(
    [missing, invalid, forbidden].map(result => ({
      text: result.result.messages[0].text,
      channel: result.result.messages[0].channel,
    })),
    [
      { text: ANNOUNCEMENT_MESSAGES.usage, channel: 'source' },
      { text: ANNOUNCEMENT_MESSAGES.invalid, channel: 'source' },
      {
        text: ANNOUNCEMENT_MESSAGES.permissionDenied,
        channel: 'source',
      },
    ]
  );
});
