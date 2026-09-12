const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startBotRuntime } = require('./start-bot');
const {
  createStartCommand,
} = require('../core/use-cases/common/start-command');
const { createAddmeCommand } = require('../core/use-cases/bench/addme-command');
const { createBenchCommand } = require('../core/use-cases/bench/bench-command');
const {
  createTelegramBenchIdentityPolicy,
} = require('../platforms/telegram/bench-identity-policy');
const {
  createTelegramPermissionPolicy,
} = require('../platforms/telegram/permission-policy');

function createFixture(t) {
  const bot = new EventEmitter();
  const sent = [];
  const state = { bench: [] };
  const permissions = [];
  let saves = 0;
  let commandsEnabled = true;
  let permissionEnabled = true;
  const permissionPolicy = createTelegramPermissionPolicy({ env: {} });
  bot.sendMessage = async (chatId, text, options) => {
    sent.push({ chatId, text, options });
    return { message_id: sent.length };
  };
  const runtime = startBotRuntime({
    bot,
    definitions: [
      createStartCommand(),
      createAddmeCommand({
        identityPolicy: createTelegramBenchIdentityPolicy(),
      }),
      createBenchCommand(),
    ],
    telegramChannelConfig: {
      chatId: '-100999',
      threads: { main: '8', default: '7' },
    },
    commandGate: {
      async check() {
        return { available: true, commandsEnabled };
      },
    },
    permissionPolicy: {
      async isAllowed(context, permission) {
        permissions.push({ command: context.command, permission });
        return (
          permissionEnabled && permissionPolicy.isAllowed(context, permission)
        );
      },
    },
    stateRepository: {
      async load() {
        return structuredClone(state);
      },
      async save(changes) {
        saves += 1;
        Object.assign(state, changes);
      },
    },
  });
  t.after(() => runtime.stop());
  return {
    runtime,
    sent,
    state,
    permissions,
    get saves() {
      return saves;
    },
    pause() {
      commandsEnabled = false;
    },
    deny() {
      permissionEnabled = false;
    },
  };
}

function event(text, from = {}) {
  return {
    text,
    from: { id: 123, first_name: 'Nghia', ...from },
    chat: { id: -456, type: 'supergroup' },
    message_thread_id: 10,
  };
}

test('Telegram /start and help button show the menu in the source chat', async t => {
  const fixture = createFixture(t);
  const privateEvent = {
    text: '/start',
    from: { id: 123, first_name: 'Nghia' },
    chat: { id: 123, type: 'private' },
  };
  await fixture.runtime.adapter.handleEvent(privateEvent);
  await fixture.runtime.adapter.handleEvent(event('📖 Hướng dẫn'));

  assert.equal(fixture.sent.length, 2);
  assert.equal(fixture.sent[0].chatId, '123');
  assert.equal(fixture.sent[0].options.message_thread_id, undefined);
  assert.equal(fixture.sent[1].chatId, '-456');
  assert.equal(fixture.sent[1].options.message_thread_id, '10');
  for (const message of fixture.sent) {
    assert.match(message.text, /CHIATEAM BOT/);
    assert.ok(
      message.options.reply_markup.keyboard
        .flat()
        .some(button => button.text === '➕ Tham gia')
    );
  }
  assert.equal(fixture.saves, 0);
});

test('Telegram menu joins once, reads bench, and obeys pause and permissions', async t => {
  const fixture = createFixture(t);
  const { adapter } = fixture.runtime;

  await adapter.handleEvent(event('➕ Tham gia'));
  assert.deepEqual(fixture.state.bench, [
    [123, { name: 'Nghia', userId: 123 }],
  ]);
  assert.equal(fixture.saves, 1);
  assert.equal(fixture.sent[0].chatId, '-100999');
  assert.equal(fixture.sent[0].options.message_thread_id, '8');

  await adapter.handleEvent(event('/addme'));
  assert.equal(fixture.saves, 1);
  assert.match(fixture.sent[1].text, /Đã có tên Nghia/);
  await adapter.handleEvent(event('📋 Bench'));
  assert.match(fixture.sent[2].text, /Nghia/);
  assert.equal(fixture.sent[2].options.message_thread_id, '7');
  assert.deepEqual(fixture.permissions, [
    { command: 'addme', permission: 'player' },
    { command: 'addme', permission: 'player' },
    { command: 'bench', permission: 'player' },
  ]);

  fixture.deny();
  await adapter.handleEvent(
    event('➕ Tham gia', { id: 789, first_name: 'Minh' })
  );
  assert.equal(fixture.saves, 1);
  assert.equal(fixture.permissions.length, 4);

  fixture.pause();
  await adapter.handleEvent(
    event('➕ Tham gia', { id: 789, first_name: 'Minh' })
  );
  assert.equal(fixture.saves, 1);
  assert.equal(fixture.permissions.length, 4);
  assert.match(fixture.sent.at(-1).text, /paused/i);
  assert.equal(fixture.sent.at(-1).chatId, '-456');
  assert.equal(fixture.sent.at(-1).options.message_thread_id, '10');
});
