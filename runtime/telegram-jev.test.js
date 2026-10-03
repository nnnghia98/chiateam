const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startBotRuntime } = require('./start-bot');
const {
  createJevIntentRouter,
} = require('../platforms/telegram/jev-intent-router');
const {
  createVoteCommand,
} = require('../core/use-cases/management/vote-command');
let botId = 42;

function fixture(t) {
  let now = 10000;
  t.mock.method(Date, 'now', () => now);
  const sent = [];
  const requests = [];
  const state = {
    activeVote: {
      id: 'poll-1',
      platform: 'telegram',
      question: 'Đá không?',
      options: ['0', '1'],
      votes: {},
    },
  };
  let saves = 0;
  let enabled = true;
  let permitted = true;
  let answer = {
    type: 'choice',
    choice: 'vote_yes',
    confidence: 0.99,
    probabilities: { vote_yes: 0.99 },
  };
  let networkError = false;
  let changePoll = false;
  let waitForResponse;
  let requestEntered;
  const bot = new EventEmitter();
  bot.sendMessage = async (chatId, text, options) =>
    sent.push({ chatId, text, options });
  const stateRepository = {
    load: async () => structuredClone(state),
    save: async changes => {
      saves++;
      Object.assign(state, changes);
    },
  };
  const naturalLanguage = createJevIntentRouter({
    identity: { id: botId++, username: 'ChiaBot' },
    env: { TYPESAFE_API_KEY: 'test-key' },
    stateRepository,
    fetchImpl: async (url, options) => {
      requests.push({
        url,
        body: JSON.parse(options.body),
        headers: options.headers,
      });
      requestEntered?.();
      if (waitForResponse) await waitForResponse;
      if (changePoll) state.activeVote.id = 'new-poll';
      if (networkError) throw new Error('Do not expose test-key');
      return { ok: true, json: async () => ({ answers: { action: answer } }) };
    },
  });
  const runtime = startBotRuntime({
    bot,
    naturalLanguage,
    stateRepository,
    definitions: [createVoteCommand()],
    env: {},
    allowedSlashCommands: ['start'],
    permissionPolicy: { isAllowed: async () => permitted },
    commandGate: {
      check: async () => ({ available: true, commandsEnabled: enabled }),
    },
  });
  t.after(() => runtime.stop());
  return {
    runtime,
    state,
    sent,
    requests,
    get saves() {
      return saves;
    },
    advance() {
      now += 5000;
    },
    choose(choice, confidence = 0.99) {
      answer = {
        type: 'choice',
        choice,
        confidence,
        probabilities: { [choice]: confidence },
      };
    },
    pause() {
      enabled = false;
    },
    deny() {
      permitted = false;
    },
    fail() {
      networkError = true;
    },
    changePoll() {
      changePoll = true;
    },
    hold() {
      const entered = new Promise(resolve => {
        requestEntered = resolve;
      });
      let release;
      waitForResponse = new Promise(resolve => {
        release = resolve;
      });
      return { entered, release };
    },
  };
}

function event(text = '@ChiaBot vote for me', id = 7) {
  return {
    text,
    from: { id, first_name: 'Nghia' },
    chat: { id: -10, type: 'supergroup' },
    message_thread_id: 9,
    entities: [{ type: 'mention', offset: 0, length: 8 }],
  };
}

test('Jev Telegram vote saves the sender choice, keeps source topic, and limits spam', async t => {
  const f = fixture(t);
  await f.runtime.adapter.handleEvent(event());
  assert.equal(f.state.activeVote.votes['7'].choice, '1');
  assert.equal(f.state.activeVote.votes['7'].name, 'Nghia');
  assert.equal(f.saves, 1);
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].text, /Nghia: ⚽️ Đá/);
  assert.equal(f.sent[0].chatId, '-10');
  assert.equal(f.sent[0].options.message_thread_id, '9');
  assert.equal(f.requests[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(f.requests[0].headers.Authorization, 'Bearer test-key');
  assert.equal(f.requests[0].body.model, 'jev-latest');
  assert.deepEqual(f.requests[0].body.state, {
    message: '@ChiaBot vote for me',
  });
  await f.runtime.adapter.handleEvent(event());
  assert.equal(f.requests.length, 1);
  assert.equal(f.sent.length, 1);
  f.advance();
  f.choose('vote_no');
  await f.runtime.adapter.handleEvent(event('@ChiaBot không đá'));
  assert.equal(f.state.activeVote.votes['7'].choice, '0');
  assert.equal(f.saves, 2);
});

test('Jev rejects unrelated, uncertain, and invented actions without saving state', async t => {
  const f = fixture(t);
  const cases = [
    ['no_match', 0.99, /chỉ hỗ trợ/],
    ['vote_yes', 0.5, /chưa rõ/],
    ['clearteam', 0.99, /chưa thể/],
    ['constructor', 0.99, /chưa thể/],
    ['zalosay', 0.99, /chưa thể/],
  ];
  for (const [choice, confidence, reply] of cases) {
    f.advance();
    f.choose(choice, confidence);
    await f.runtime.adapter.handleEvent(event('@ChiaBot USD rate today?'));
    assert.match(f.sent.at(-1).text, reply);
  }
  assert.equal(f.saves, 0);
  assert.deepEqual(f.state.activeVote.votes, {});
});

test('Jev keeps permissions, disabled controls, no-vote checks, and API failures safe', async t => {
  const f = fixture(t);
  f.deny();
  await f.runtime.adapter.handleEvent(event());
  assert.equal(f.saves, 0);
  assert.match(f.sent.at(-1).text, /không có quyền/);
  f.pause();
  await f.runtime.adapter.handleEvent(event('@ChiaBot vote', 8));
  assert.equal(f.requests.length, 1, 'paused bot does not call Jev');
  assert.match(f.sent.at(-1).text, /paused/i);
  const failed = fixture(t);
  failed.fail();
  await failed.runtime.adapter.handleEvent(event('@ChiaBot vote for me', 9));
  assert.equal(failed.saves, 0);
  assert.match(failed.sent.at(-1).text, /chưa thể/);
  assert.doesNotMatch(failed.sent.at(-1).text, /test-key/);
  const empty = fixture(t);
  empty.state.activeVote = null;
  await empty.runtime.adapter.handleEvent(event('@ChiaBot vote for me', 10));
  assert.equal(empty.saves, 0);
  assert.match(empty.sent.at(-1).text, /Chưa có vote/);
});

test('Jev ignores group chat without own mention and preserves slash/button routes', async t => {
  const f = fixture(t);
  const adapter = f.runtime.adapter;
  assert.equal(
    await adapter.handleEvent({ ...event('vote'), entities: [] }),
    false
  );
  assert.equal(await adapter.handleEvent(event('@OtherBot vote')), false);
  assert.equal(await adapter.handleEvent(event('/vote 1')), false);
  assert.equal(
    await adapter.handleEvent({ ...event(), from: { id: 99, is_bot: true } }),
    false
  );
  assert.equal(f.requests.length, 0);
  await adapter.handleEvent(event('🗳️ Vote ngay'));
  assert.equal(f.requests.length, 0);
  assert.match(f.sent.at(-1).text, /Chọn 1 option/);
  await adapter.handleEvent({
    ...event('vote for me'),
    entities: [],
    chat: { id: 11, type: 'private' },
  });
  assert.equal(f.state.activeVote.votes['7'].choice, '1');
  assert.equal(f.requests.length, 1);
  assert.equal(f.sent.at(-1).chatId, '11');
});

test('Jev refuses a vote if the poll changed during inference', async t => {
  const f = fixture(t);
  f.changePoll();
  await f.runtime.adapter.handleEvent(event('@ChiaBot vote for me', 12));
  assert.equal(f.saves, 0);
  assert.match(f.sent.at(-1).text, /Vote đã thay đổi/);
});

test('a menu action supersedes an unfinished Jev vote and duplicate requests do not run', async t => {
  const f = fixture(t);
  const hold = f.hold();
  const first = f.runtime.adapter.handleEvent(event());
  await hold.entered;
  f.advance();
  await f.runtime.adapter.handleEvent(event());
  assert.equal(f.requests.length, 1, 'one active request for this sender');
  await f.runtime.adapter.handleEvent(event('🗳️ Vote ngay'));
  hold.release();
  await first;
  assert.equal(f.saves, 0);
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].text, /Chọn 1 option/);
});

test('stopping the Telegram adapter cancels an unfinished Jev request', async t => {
  const f = fixture(t);
  const hold = f.hold();
  const first = f.runtime.adapter.handleEvent(event());
  await hold.entered;
  f.runtime.stop();
  hold.release();
  await first;
  assert.equal(f.saves, 0);
  assert.equal(f.sent.length, 0);
});

test('literal vote records yes without AI inference and still limits spam', async t => {
  const f = fixture(t);
  f.fail();
  await f.runtime.adapter.handleEvent(event('@ChiaBot vote'));
  assert.equal(f.state.activeVote.votes['7'].choice, '1');
  assert.equal(f.saves, 1);
  await f.runtime.adapter.handleEvent(event('@ChiaBot vote'));
  assert.equal(f.saves, 1);
  assert.equal(f.sent.length, 1);
  await f.runtime.adapter.handleEvent({
    ...event(' VOTE ', 8),
    entities: [],
    chat: { id: 8, type: 'private' },
  });
  assert.equal(f.state.activeVote.votes['8'].choice, '1');
  assert.equal(f.saves, 2);
  assert.equal(f.requests.length, 0);
});
