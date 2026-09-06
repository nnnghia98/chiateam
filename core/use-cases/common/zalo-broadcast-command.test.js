const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommandRegistry } = require('../../commands/command-registry');
const { createCommandRouter } = require('../../commands/command-router');
const { createZaloBroadcastCommand } = require('./zalo-broadcast-command');
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
  assert.match(
    response.result.messages[0].text,
    new RegExp(`/zalosay confirm ${id}`)
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
    command: 'subscribe',
  });
  assert.deepEqual(calls[0], {
    userId: 'admin',
    chatId: 'source',
    chatType: 'private',
  });
  assert.match(response.result.messages[0].text, /\/unsubscribe/);
  await r.run({ ...context([], 'zalo'), command: 'unsubscribe' });
  assert.equal(calls.length, 2);
});
