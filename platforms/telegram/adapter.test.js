const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  createRichTextResult,
  createTextResult,
} = require('../../core/contracts/command-result');
const {
  createTelegramAdapter,
  parseCommandText,
  parseTelegramCommandAction,
} = require('./adapter');

class MockTelegramBot extends EventEmitter {
  constructor() {
    super();
    this.sentMessages = [];
    this.answeredCallbacks = [];
  }

  async sendMessage(chatId, text, options) {
    this.sentMessages.push({ chatId, text, options });
    return { ok: true };
  }

  async answerCallbackQuery(id, options) {
    this.answeredCallbacks.push({ id, options });
    return { ok: true };
  }
}

function createEvent(text = '/bench') {
  return {
    text,
    from: {
      id: 123,
      first_name: 'Nghia',
      last_name: 'Nguyen',
      username: 'nghia',
    },
    chat: { id: -456 },
    message_thread_id: 10,
  };
}

test('Telegram command parser supports mentions and arguments', () => {
  assert.deepEqual(parseCommandText('/TEAM@ChiaTeamBot 3'), {
    command: 'TEAM',
    args: ['3'],
  });
  assert.equal(parseCommandText('hello'), null);
  assert.deepEqual(parseTelegramCommandAction('core:cmd:/editbench 2'), {
    command: 'editbench',
    args: ['2'],
  });
  assert.equal(parseTelegramCommandAction('editbench:select:1'), null);
});

test('Telegram adapter creates a platform-neutral command context', () => {
  const bot = new MockTelegramBot();
  const adapter = createTelegramAdapter({
    bot,
    router: { run: async () => ({ handled: false }) },
  });

  const context = adapter.toCommandContext(
    createEvent('/edit-stats@ChiaTeamBot 10 4 3 1 0')
  );

  assert.deepEqual(context, {
    command: 'edit-stats',
    args: ['10', '4', '3', '1', '0'],
    actor: {
      platform: 'telegram',
      externalId: '123',
      displayName: 'Nghia Nguyen',
      username: 'nghia',
    },
    conversation: {
      externalId: '-456',
      threadId: '10',
    },
  });
  assert.equal('rawEvent' in context, false);
});

test('Telegram adapter ignores commands not owned by the new runtime', async () => {
  const bot = new MockTelegramBot();
  const adapter = createTelegramAdapter({
    bot,
    router: {
      run: async () => ({ handled: false, result: null }),
    },
  });

  const handled = await adapter.handleEvent(createEvent('/legacy'));

  assert.equal(handled, false);
  assert.equal(bot.sentMessages.length, 0);
});

test('Telegram adapter sends common text and actions to the source thread', async () => {
  const bot = new MockTelegramBot();
  const adapter = createTelegramAdapter({
    bot,
    router: {
      run: async () => ({
        handled: true,
        result: createTextResult('Bench ready.', [
          { id: 'view_team', label: 'View team' },
        ]),
      }),
    },
  });

  const handled = await adapter.handleEvent(createEvent());

  assert.equal(handled, true);
  assert.deepEqual(bot.sentMessages, [
    {
      chatId: '-456',
      text: 'Bench ready.',
      options: {
        message_thread_id: '10',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'View team', callback_data: 'view_team' }],
          ],
        },
      },
    },
  ]);
});

test('Telegram adapter routes command actions and their next text input', async () => {
  const bot = new MockTelegramBot();
  const contexts = [];
  const adapter = createTelegramAdapter({
    bot,
    router: {
      async run(context) {
        contexts.push(context);

        if (context.args.length === 1) {
          return {
            handled: true,
            result: createTextResult('Enter a new name.', [], {
              input: { command: 'editbench', args: context.args },
            }),
          };
        }

        return {
          handled: true,
          result: createTextResult(`Renamed to ${context.args[1]}.`),
        };
      },
    },
  });

  const actionHandled = await adapter.handleAction({
    id: 'callback-1',
    data: 'core:cmd:/editbench 2',
    from: createEvent().from,
    message: {
      chat: { id: -456 },
      message_thread_id: 10,
      message_id: 99,
    },
  });
  const inputHandled = await adapter.handleEvent(createEvent('New Name'));

  assert.equal(actionHandled, true);
  assert.equal(inputHandled, true);
  assert.deepEqual(
    contexts.map(context => ({
      command: context.command,
      args: context.args,
    })),
    [
      { command: 'editbench', args: ['2'] },
      { command: 'editbench', args: ['2', 'New Name'] },
    ]
  );
  assert.deepEqual(bot.answeredCallbacks, [
    {
      id: 'callback-1',
      options: { text: '', show_alert: false },
    },
  ]);
  assert.equal(bot.sentMessages[0].text, 'Enter a new name.');
  assert.equal(bot.sentMessages[1].text, 'Renamed to New Name.');
});

test('Telegram adapter encodes action fallback commands in buttons', async () => {
  const bot = new MockTelegramBot();
  const adapter = createTelegramAdapter({
    bot,
    router: {
      run: async () => ({
        handled: true,
        result: createTextResult('Choose.', [
          {
            id: 'editbench_select_2',
            label: '2. Minh',
            command: '/editbench 2',
          },
        ]),
      }),
    },
  });

  await adapter.handleEvent(createEvent('/editbench'));

  assert.equal(
    bot.sentMessages[0].options.reply_markup.inline_keyboard[0][0]
      .callback_data,
    'core:cmd:/editbench 2'
  );
});

test('Telegram adapter renders generic rich text and escapes platform markup', async () => {
  const bot = new MockTelegramBot();
  const adapter = createTelegramAdapter({
    bot,
    router: {
      run: async () => ({
        handled: true,
        result: createRichTextResult([
          { text: 'HOME (1):', bold: true },
          { text: '\nHome_player' },
        ]),
      }),
    },
  });

  await adapter.handleEvent(createEvent('/team'));

  assert.equal(bot.sentMessages[0].text, '*HOME \\(1\\):*\nHome\\_player');
  assert.equal(bot.sentMessages[0].options.parse_mode, 'MarkdownV2');
});

test('Telegram adapter maps a logical channel to configured chat and thread', async () => {
  const bot = new MockTelegramBot();
  const adapter = createTelegramAdapter({
    bot,
    channelConfig: {
      chatId: '-100999',
      threads: { announcement: '88' },
    },
    router: {
      run: async () => ({
        handled: true,
        result: createTextResult('Fee ready.', [], {
          channel: 'announcement',
        }),
      }),
    },
  });

  await adapter.handleEvent(createEvent('/chiatien'));

  assert.deepEqual(bot.sentMessages, [
    {
      chatId: '-100999',
      text: 'Fee ready.',
      options: { message_thread_id: '88' },
    },
  ]);
});

test('Telegram adapter start and stop keep legacy listeners untouched', () => {
  const bot = new MockTelegramBot();
  const legacyListener = () => {};
  bot.on('message', legacyListener);
  const adapter = createTelegramAdapter({
    bot,
    router: { run: async () => ({ handled: false }) },
  });

  adapter.start();
  adapter.start();
  assert.equal(bot.listenerCount('message'), 2);

  adapter.stop();
  assert.equal(bot.listenerCount('message'), 1);
  assert.equal(bot.listeners('message')[0], legacyListener);
});

test('Telegram adapter registers and removes its shared action handler', () => {
  const bot = new MockTelegramBot();
  let registeredHandler = null;
  let registerCount = 0;
  let unregisterCount = 0;
  const adapter = createTelegramAdapter({
    bot,
    router: { run: async () => ({ handled: false }) },
    registerActionHandler(handler) {
      registerCount += 1;
      registeredHandler = handler;
      return () => {
        unregisterCount += 1;
      };
    },
  });

  adapter.start();
  adapter.start();

  assert.equal(typeof registeredHandler, 'function');
  assert.equal(registerCount, 1);
  assert.equal(bot.listenerCount('callback_query'), 0);

  adapter.stop();
  adapter.stop();

  assert.equal(unregisterCount, 1);
});
