const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { startBotRuntime } = require('./start-bot');
const { startZaloBotRuntime } = require('./start-zalo-bot');
const {
  createStartCommand,
} = require('../core/use-cases/common/start-command');
const { createBenchCommand } = require('../core/use-cases/bench/bench-command');
const {
  createManagedCommandRules,
} = require('../core/commands/managed-command-rules');
const {
  createZaloCommandDefinitions,
} = require('./create-zalo-command-definitions');
const {
  createAllowAllPermissionPolicy,
} = require('../core/ports/permission-policy');

function gate() {
  return { check: async () => ({ available: true, commandsEnabled: true }) };
}

function stateRepository() {
  return {
    async load() {
      return {};
    },
    async save() {},
  };
}

function telegramEvent(text, overrides = {}) {
  return {
    text,
    from: { id: 42, first_name: 'Nghia', ...(overrides.from || {}) },
    chat: { id: -10042, type: 'supergroup', ...(overrides.chat || {}) },
    message_thread_id: 17,
    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([key]) => !['from', 'chat'].includes(key)
      )
    ),
  };
}

test('Telegram /start renders source thread help once, with keyboard and managed entries', async t => {
  const bot = new EventEmitter();
  const sent = [];
  bot.sendMessage = async (chatId, text, options) => {
    sent.push({ chatId, text, options });
    return { message_id: sent.length };
  };

  const env = {
    TELEGRAM_COMMAND_RULES: JSON.stringify({
      bench: { enabled: false },
      manifests: { enabled: false },
    }),
  };
  const runtime = startBotRuntime({
    bot,
    env,
    definitions: [
      createStartCommand({ commandRules: createManagedCommandRules(env) }),
      createBenchCommand(),
    ],
    telegramChannelConfig: { chatId: '-100999', threads: { main: '8' } },
    commandGate: gate(),
    permissionPolicy: createAllowAllPermissionPolicy(),
    stateRepository: stateRepository(),
  });
  t.after(() => runtime.stop());

  await runtime.adapter.handleEvent(
    telegramEvent('/start@chiateam_bot', { from: { first_name: 'Nghia' } })
  );

  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, '-10042');
  assert.equal(sent[0].options.message_thread_id, '17');
  assert.equal(sent[0].options.parse_mode, 'MarkdownV2');
  assert.ok(
    sent[0].options.reply_markup.keyboard
      .flat()
      .some(button => button.text === '📖 Hướng dẫn')
  );
  assert.match(sent[0].text, /\*👋 CHIATEAM BOT\*/);
  assert.match(sent[0].text, /BẮT ĐẦU NHANH/);
  assert.doesNotMatch(sent[0].text, /\/bench/);
  assert.doesNotMatch(sent[0].text, /\/manifests/);
  assert.doesNotMatch(sent[0].text, /\/mf\b/);
  assert.equal((sent[0].text.match(/\/addme/g) || []).length, 1);
  assert.match(sent[0].text, /\/addtoteam[^\n]*admin/);

  await runtime.adapter.handleEvent(telegramEvent('/bench'));
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /This command is paused/);
});

function zaloUpdate(text, messageId = 'start-1', displayName = 'Nghia') {
  return {
    ok: true,
    result: {
      event_name: 'message.text.received',
      message: {
        from: { id: 'user-1', display_name: displayName, is_bot: false },
        chat: { id: 'chat-1', chat_type: 'PRIVATE' },
        text,
        message_id: messageId,
        date: 1,
      },
    },
  };
}

class FakeZaloClient extends EventEmitter {
  constructor() {
    super();
    this.sentMessages = [];
  }

  async sendMessage(chatId, text, options) {
    this.sentMessages.push({ chatId, text, options });
    return { message_id: `sent-${this.sentMessages.length}` };
  }
}

for (const mode of ['polling', 'webhook']) {
  test(`Zalo ${mode} /start combines greeting and generated help`, async t => {
    const client = new FakeZaloClient();
    let claims = 0;
    const env = {
      ZALO_GREETING_TEXT: 'Xin chào {name}! *welcome*',
      ZALO_COMMAND_RULES: JSON.stringify({
        team: { enabled: false },
        unsubscribe: { enabled: false },
      }),
    };
    const runtime = startZaloBotRuntime({
      client,
      env,
      definitions: createZaloCommandDefinitions({
        env,
        subscriptionRepository: {
          async subscribe() {},
          async unsubscribe() {},
        },
      }),
      stateRepository: stateRepository(),
      permissionPolicy: createAllowAllPermissionPolicy(),
      commandGate: gate(),
      mode,
      listenForClientEvents: mode === 'polling',
      greetingRepository: {
        async claim() {
          claims += 1;
          return claims === 1;
        },
      },
    });
    t.after(() => runtime.stop());

    await runtime.adapter.handleUpdate(
      zaloUpdate('/start', `${mode}-1`, 'A*_\nB')
    );

    assert.equal(client.sentMessages.length, 1);
    assert.equal(client.sentMessages[0].chatId, 'chat-1');
    assert.equal(client.sentMessages[0].options.parse_mode, 'markdown');
    assert.match(
      client.sentMessages[0].text,
      /Xin chào A\\\*\\_ B! \\\*welcome\\\*/
    );
    assert.match(client.sentMessages[0].text, /\/subscribe/);
    assert.match(client.sentMessages[0].text, /\/unsubscribe/);
    assert.match(client.sentMessages[0].text, /\/poll/);
    assert.match(client.sentMessages[0].text, /\/vote/);
    assert.match(client.sentMessages[0].text, /\/demvote/);
    assert.match(client.sentMessages[0].text, /\/bench/);
    assert.doesNotMatch(client.sentMessages[0].text, /\/team/);
    assert.doesNotMatch(client.sentMessages[0].text, /\/zalosay|\/say/);
  });
}
