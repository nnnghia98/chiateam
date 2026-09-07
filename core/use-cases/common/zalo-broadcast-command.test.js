const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createZaloBroadcastCommand } = require('./zalo-broadcast-command');
const {
  formatTelegramMessage,
} = require('../../../platforms/telegram/formatter');
const {
  createZaloSubscriptionCommand,
} = require('./zalo-subscription-command');

const id = '11111111-1111-4111-8111-111111111111';
const context = (args, platform = 'telegram', type = 'private') => ({
  command: 'zalosay',
  args,
  actor: { platform, externalId: 'admin' },
  conversation: { externalId: 'source', type },
});

function router(definitions, allowed = true) {
  return createCommandRouter({
    registry: createCommandRegistry(definitions),
    permissionPolicy: { isAllowed: () => allowed },
    stateRepository: {
      load: async () => {
        throw new Error('Must not load match state');
      },
      save: async () => {
        throw new Error('Must not write match state');
      },
    },
  });
}

function harness(overrides = {}) {
  const calls = [];
  const service = {
    prepare: async (message, ctx) => {
      calls.push(['prepare', message, ctx]);
      return { id, total: 2 };
    },
    confirm: async () => {
      calls.push(['confirm']);
      return { code: 'UNAUTHORIZED' };
    },
    cancel: async () => true,
    status: async () => null,
    ...overrides,
  };
  const definition = createZaloBroadcastCommand({ service });
  return { calls, definition, router: router([definition]) };
}

test('broadcast command previews exact content without sending and uses the source chat', async () => {
  const h = harness();
  const response = await h.router.run(context(['Hello', 'team']));
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], 'prepare');
  assert.match(response.result.messages[0].text, /2 người.*\n\nHello team/);
  assert.doesNotMatch(response.result.messages[0].text, new RegExp(id));
  assert.deepEqual(
    response.result.messages[0].actions.map(action => action.command),
    [`/zalosay confirm ${id}`, `/zalosay cancel ${id}`]
  );
  const buttons = formatTelegramMessage(
    response.result.messages[0]
  ).options.reply_markup.inline_keyboard.flat();
  assert.deepEqual(
    buttons.map(button => button.text),
    ['✅ Gửi thông báo', '❌ Hủy']
  );
  assert.ok(
    buttons.every(
      button => Buffer.byteLength(button.callback_data, 'utf8') <= 64
    )
  );
  assert.equal(response.result.messages[0].channel, 'source');
});

test('broadcast requires admin and Telegram and rejects malformed confirmations', async () => {
  const h = harness();
  await router([h.definition], false).run(context(['Hello']));
  await h.router.run(context(['Hello'], 'zalo'));
  for (const args of [
    [],
    ['confirm'],
    ['confirm', id, 'extra'],
    ['cancel', 'bad-id'],
    ['x'.repeat(2001)],
  ])
    await h.router.run(context(args));
  assert.equal(h.calls.length, 0);
});

test('broadcast reports missing subscribers, cancellation and safe actionable errors', async () => {
  const h = harness({ prepare: async () => ({ id, total: 0 }) });
  assert.match(
    (await h.router.run(context(['Hello']))).result.messages[0].text,
    /\/subscribe/
  );
  assert.match(
    (await h.router.run(context(['cancel', id]))).result.messages[0].text,
    /Đã hủy/
  );
  assert.match(
    (await h.router.run(context(['confirm', id]))).result.messages[0].text,
    /401/
  );
  const failing = harness({
    prepare: async () => {
      throw new Error('secret-token');
    },
  });
  const text = (await failing.router.run(context(['Hello']))).result.messages[0]
    .text;
  assert.doesNotMatch(text, /secret-token/);
  assert.match(text, /API và database/);
});

test('subscription commands only change their own private Zalo conversation', async () => {
  const calls = [];
  const repository = {
    subscribe: async p => calls.push(p),
    unsubscribe: async p => calls.push(p),
  };
  const definitions = [true, false].map(subscribed =>
    createZaloSubscriptionCommand({ repository, subscribed })
  );
  const r = router(definitions);
  for (const [platform, type] of [
    ['zalo', 'group'],
    ['telegram', 'private'],
    ['zalo', 'unknown'],
  ]) {
    await r.run({ ...context([], platform, type), command: 'subscribe' });
  }
  assert.equal(calls.length, 0);
  const response = await r.run({
    ...context([], 'zalo'),
    actor: { platform: 'zalo', externalId: 'admin', displayName: 'Nghĩa' },
    command: 'subscribe',
  });
  assert.deepEqual(calls[0], {
    userId: 'admin',
    chatId: 'source',
    chatType: 'private',
    displayName: 'Nghĩa',
  });
  assert.match(response.result.messages[0].text, /\/unsubscribe/);
  await r.run({ ...context([], 'zalo'), command: 'unsubscribe' });
  assert.equal(calls.length, 2);
});

test('admins can list subscriber names and IDs without preparing a broadcast', async () => {
  const pages = [];
  const h = harness({
    subscribers: async page => {
      pages.push(page);
      return {
        total: 12,
        page,
        pageSize: 10,
        subscribers: [
          { userId: 'u1', chatId: 'c1', displayName: 'Nghĩa' },
          { userId: 'u2', chatId: 'c2', displayName: null },
        ],
      };
    },
  });
  const reply = (await h.router.run(context(['subscribers']))).result
    .messages[0];
  assert.match(reply.text, /Nghĩa\nUser ID: u1\nChat ID: c1/);
  assert.match(reply.text, /Chưa có tên/);
  assert.match(reply.text, /\/zalosay subscribers 2/);
  assert.equal(reply.channel, 'source');
  assert.equal(h.calls.length, 0);
  await h.router.run(context(['subscribers', '2']));
  await router([h.definition], false).run(context(['subscribers']));
  await h.router.run(context(['subscribers'], 'zalo'));
  for (const args of [
    ['subscribers', '0'],
    ['subscribers', '-1'],
    ['subscribers', '1.5'],
    ['subscribers', '1000001'],
    ['subscribers', '2', 'extra'],
  ])
    await h.router.run(context(args));
  assert.deepEqual(pages, [1, 2]);
  assert.equal(h.calls.length, 0);
});

test('subscriber list handles empty pages and long names within message limits', async () => {
  const empty = harness({
    subscribers: async () => ({
      total: 0,
      page: 1,
      pageSize: 10,
      subscribers: [],
    }),
  });
  assert.match(
    (await empty.router.run(context(['subscribers']))).result.messages[0].text,
    /Chưa có người đăng ký/
  );
  const beyond = harness({
    subscribers: async () => ({
      total: 11,
      page: 3,
      pageSize: 10,
      subscribers: [],
    }),
  });
  const text = (await beyond.router.run(context(['subscribers', '3']))).result
    .messages[0].text;
  assert.match(text, /Trang này không có/);
  assert.match(text, /\/zalosay subscribers 2/);
  const long = harness({
    subscribers: async () => ({
      total: 10,
      page: 1,
      pageSize: 10,
      subscribers: Array.from({ length: 10 }, () => ({
        displayName: 'a'.repeat(256),
        userId: 'u'.repeat(256),
        chatId: 'c'.repeat(256),
      })),
    }),
  });
  const messages = (await long.router.run(context(['subscribers']))).result
    .messages;
  assert.ok(messages.length > 1);
  assert.ok(messages.every(message => message.text.length <= 3500));
  assert.equal(
    messages.reduce(
      (sum, message) => sum + (message.text.match(/User ID:/g) || []).length,
      0
    ),
    10
  );
});
