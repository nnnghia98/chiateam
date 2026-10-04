const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startBotRuntime } = require('./start-bot');
const {
  createStartCommand,
} = require('../core/use-cases/common/start-command');
const {
  createVoteCommand,
} = require('../core/use-cases/management/vote-command');
const {
  createTelegramPermissionPolicy,
} = require('../platforms/telegram/permission-policy');
const { createReplyKeyboard } = require('../platforms/telegram/reply-keyboard');
const {
  TELEGRAM_ALLOWED_SLASH_COMMANDS,
} = require('../platforms/telegram/command-menu');
const {
  createResetCommand,
} = require('../core/use-cases/management/reset-command');

function createFixture(t) {
  const bot = new EventEmitter();
  const sent = [];
  const state = {
    bench: [],
    activeVote: {
      id: 'poll-1',
      platform: 'telegram',
      question: 'Sân A 20h',
      options: ['0', '+1', '+2', '+3', '+4'],
      totalVoters: 0,
      votes: {},
    },
  };
  const permissions = [];
  let saves = 0;
  let commandsEnabled = true;
  let permissionEnabled = true;
  const permissionPolicy = createTelegramPermissionPolicy({
    env: { BOT_ADMIN_IDS: '123' },
  });
  bot.sendMessage = async (chatId, text, options) => {
    sent.push({ chatId, text, options });
    return { message_id: sent.length };
  };
  const runtime = startBotRuntime({
    bot,
    definitions: [
      createStartCommand({ menuOnly: true }),
      createVoteCommand(),
      createResetCommand({
        voteController: { close: async () => ({ closed: true }) },
      }),
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
    allowedSlashCommands: TELEGRAM_ALLOWED_SLASH_COMMANDS,
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

test('Telegram /start show the menu in the source chat', async t => {
  const fixture = createFixture(t);
  const privateEvent = {
    text: '/start',
    from: { id: 123, first_name: 'Nghia' },
    chat: { id: 123, type: 'private' },
  };
  await fixture.runtime.adapter.handleEvent(privateEvent);
  await fixture.runtime.adapter.handleEvent(event('/start'));

  assert.equal(fixture.sent.length, 2);
  assert.equal(fixture.sent[0].chatId, '123');
  assert.equal(fixture.sent[0].options.message_thread_id, undefined);
  assert.equal(fixture.sent[1].chatId, '-456');
  assert.equal(fixture.sent[1].options.message_thread_id, '10');
  for (const message of fixture.sent) {
    assert.match(message.text, /CHIATEAM BOT/);
    assert.deepEqual(message.options.reply_markup, createReplyKeyboard());
    assert.ok(
      message.options.reply_markup.keyboard
        .flat()
        .some(button => button.text === '🗳️ Vote ngay')
    );
  }
  assert.equal(fixture.saves, 0);
});

test('Telegram vote menu opens choices and records the selected answer', async t => {
  const fixture = createFixture(t);
  const { adapter } = fixture.runtime;

  fixture.state.activeVote.options = ['0', '1'];
  await adapter.handleEvent(event('🗳️ Vote ngay'));
  assert.match(fixture.sent[0].text, /Chọn 1 option/);
  const yesCallback =
    fixture.sent[0].options.reply_markup.inline_keyboard[0][0].callback_data;
  await adapter.handleAction({
    id: 'vote-yes',
    data: yesCallback,
    from: { id: 123, first_name: 'Nghia' },
    message: event(''),
  });
  assert.deepEqual(fixture.state.bench, []);
  assert.deepEqual(fixture.state.activeVote.votes['123'], {
    id: '123',
    platform: 'telegram',
    name: 'Nghia',
    choice: '1',
    optionIndex: 1,
    options: [1],
  });
  assert.equal(fixture.state.activeVote.totalVoters, 1);
  assert.equal(fixture.saves, 1);
  assert.match(fixture.sent[1].text, /Nghia: ⚽️ Đá/);
  assert.equal(fixture.sent[1].chatId, '-456');
  assert.equal(fixture.sent[1].options.message_thread_id, '10');

  assert.equal(await adapter.handleEvent(event('/vote 1')), true);
  assert.equal(fixture.saves, 1);
  assert.deepEqual(fixture.permissions, [
    { command: 'vote', permission: 'player' },
    { command: 'vote', permission: 'player' },
    { command: 'vote', permission: 'player' },
  ]);

  fixture.deny();
  await adapter.handleEvent(
    event('🗳️ Vote ngay', { id: 789, first_name: 'Minh' })
  );
  assert.equal(fixture.saves, 1);
  assert.equal(fixture.permissions.length, 4);
  assert.match(fixture.sent.at(-1).text, /không có quyền/);

  fixture.pause();
  await adapter.handleEvent(
    event('🗳️ Vote ngay', { id: 789, first_name: 'Minh' })
  );
  assert.equal(fixture.saves, 1);
  assert.equal(fixture.permissions.length, 4);
  assert.match(fixture.sent.at(-1).text, /paused/i);
  assert.equal(fixture.sent.at(-1).chatId, '-456');
  assert.equal(fixture.sent.at(-1).options.message_thread_id, '10');
});

test('Telegram /reset is usable by an admin and cannot reset data for a player', async t => {
  const fixture = createFixture(t);
  fixture.state.bench = [{ name: 'Existing player' }];
  await fixture.runtime.adapter.handleEvent(event('/reset', { id: 789 }));
  assert.equal(fixture.saves, 0);
  assert.equal(fixture.state.bench.length, 1);
  assert.match(fixture.sent.at(-1).text, /Chỉ admin/);
  await fixture.runtime.adapter.handleEvent(event('/reset@ChiaTeamBot'));
  assert.equal(fixture.saves, 1);
  assert.deepEqual(fixture.state.bench, []);
  assert.equal(fixture.state.activeVote, null);
  assert.match(fixture.sent.at(-1).text, /ĐÃ RESET/);
});
