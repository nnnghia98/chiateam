const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startBotRuntime } = require('./start-bot');
const { createBenchCommand } = require('../core/use-cases/bench/bench-command');
const { createTeamCommand } = require('../core/use-cases/teams/team-command');
const {
  createEditbenchCommand,
} = require('../core/use-cases/bench/editbench-command');
const {
  createTaovoteCommand,
} = require('../core/use-cases/management/taovote-command');
const {
  createTelegramPermissionPolicy,
} = require('../platforms/telegram/permission-policy');
const {
  createTelegramAttendanceVotePublisher,
} = require('../platforms/telegram/attendance-vote-publisher');

function privateEvent(text, userId = 123, threadId) {
  return {
    text,
    from: { id: userId, first_name: `Player ${userId}` },
    chat: { id: userId, type: 'private' },
    ...(threadId == null ? {} : { message_thread_id: threadId }),
  };
}

function setup(t, chatId = '-100999') {
  const sent = [];
  const polls = [];
  const state = {
    bench: [['guest', 'Minh']],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    activeVote: null,
  };
  const bot = new EventEmitter();
  bot.sendMessage = async (destination, text, options) => {
    sent.push({ chatId: destination, text, options: { ...options } });
    return { message_id: sent.length };
  };
  bot.answerCallbackQuery = async () => true;
  bot.sendPoll = async (destination, question, choices, options) => {
    polls.push({ chatId: destination, question, options });
    return { message_id: 80, poll: { id: 'poll-1' } };
  };
  const channelConfig = {
    chatId,
    threads: { default: '7', main: '8', announcement: '9' },
  };
  const runtime = startBotRuntime({
    bot,
    env: {},
    telegramChannelConfig: channelConfig,
    commandGate: {
      check: async () => ({ available: true, commandsEnabled: true }),
    },
    permissionPolicy: createTelegramPermissionPolicy({
      env: { BOT_OWNER_ID: '123' },
    }),
    stateRepository: {
      load: async () => structuredClone(state),
      save: async changes => Object.assign(state, changes),
    },
    definitions: [
      createBenchCommand(),
      createTeamCommand(),
      createEditbenchCommand(),
      createTaovoteCommand({
        votePublisher: createTelegramAttendanceVotePublisher({
          bot,
          channelConfig,
        }),
      }),
    ],
  });
  t.after(() => runtime.stop());
  return { runtime, bot, sent, polls, state };
}

test('private /bench and /team replies stay with each sender while group routing stays configured', async t => {
  const { runtime, sent } = setup(t);
  await Promise.all([
    runtime.adapter.handleEvent(privateEvent('/bench', 123)),
    runtime.adapter.handleEvent(privateEvent('/team', 456)),
  ]);
  assert.deepEqual(sent.map(message => message.chatId).sort(), ['123', '456']);
  assert.ok(sent.every(message => !('message_thread_id' in message.options)));
  assert.match(sent.find(message => message.chatId === '123').text, /Minh/);

  await runtime.adapter.handleEvent({
    ...privateEvent('/bench'),
    chat: { id: -100999, type: 'supergroup' },
    message_thread_id: 30,
  });
  assert.equal(sent[2].chatId, '-100999');
  assert.equal(sent[2].options.message_thread_id, '7');
});

test('private buttons and text input keep the same chat and admin permissions', async t => {
  const { runtime, sent, state } = setup(t);
  await runtime.adapter.handleAction({
    id: 'button-1',
    data: 'core:cmd:editbench 1',
    from: privateEvent('').from,
    message: { chat: { id: 123, type: 'private' }, message_id: 20 },
  });
  assert.match(sent[0].text, /Nhập tên mới/);
  assert.equal(
    await runtime.adapter.handleEvent(privateEvent('Ignored', 456)),
    false
  );
  await runtime.adapter.handleEvent(privateEvent('Nam'));
  assert.equal(state.bench[0][1].name, 'Nam');
  assert.ok(sent.every(message => message.chatId === '123'));

  await runtime.adapter.handleEvent(privateEvent('/editbench 1 Other', 456));
  assert.equal(sent[2].chatId, '456');
  assert.match(sent[2].text, /Chỉ admin/);
  assert.equal(state.bench[0][1].name, 'Nam');
  assert.ok(sent.every(message => !('message_thread_id' in message.options)));
});

test('a closed private topic retries in the same private chat', async t => {
  const { runtime, bot, sent } = setup(t);
  const send = bot.sendMessage;
  bot.sendMessage = async (...args) => {
    const result = await send(...args);
    if (sent.length === 1) throw new Error('TOPIC_CLOSED');
    return result;
  };
  await runtime.adapter.handleEvent(privateEvent('/bench', 123, 17));
  assert.equal(sent.length, 2);
  assert.ok(sent.every(message => message.chatId === '123'));
  assert.equal(sent[0].options.message_thread_id, '17');
  assert.ok(!('message_thread_id' in sent[1].options));
});

for (const configuredChat of ['-100999', null]) {
  test(`private /taopoll confirms privately with group destination ${configuredChat}`, async t => {
    const { runtime, sent, polls, state } = setup(t, configuredChat);
    await runtime.adapter.handleEvent(privateEvent('/taopoll Sân A 20h'));
    assert.equal(polls.length, 1);
    assert.equal(polls[0].chatId, configuredChat || '123');
    assert.equal(
      polls[0].options.message_thread_id,
      configuredChat ? '9' : undefined
    );
    assert.equal(state.activeVote.chatId, polls[0].chatId);
    assert.equal(sent[0].chatId, '123');
    assert.ok(!('message_thread_id' in sent[0].options));
    assert.match(sent[0].text, /Đã tạo vote/);
  });
}
