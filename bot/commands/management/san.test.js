const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_OWNER_ID = '123';

function createMockBot() {
  const handlers = [];
  const sentMessages = [];

  return {
    handlers,
    sentMessages,
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { ok: true };
      },
    },
  };
}

function loadSanCommand(mockBot) {
  const commandPath = require.resolve('./san');
  const chatPath = require.resolve('../../utils/chat');
  const telegramClientPath = require.resolve('../../telegram-client');

  delete require.cache[commandPath];
  delete require.cache[telegramClientPath];

  require.cache[chatPath] = {
    id: chatPath,
    filename: chatPath,
    loaded: true,
    exports: {
      CHAT_ID: '456',
      sendMessage: ({ msg, message, options }) =>
        mockBot.sendMessage(msg.chat.id, message, options),
    },
  };
  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require(commandPath);
}

async function invokeCommand(handlers, command) {
  const match = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(match, `Missing handler for ${command}`);

  await match.handler(
    {
      from: { id: 123 },
      chat: { id: 456 },
      text: command,
    },
    command.match(match.pattern)
  );
}

test('legacy venue handler can leave both commands to the shared runtime', () => {
  const mock = createMockBot();
  const sanCommand = loadSanCommand(mock.bot);
  let venue = 'Sân số 8';

  sanCommand({
    getSan: () => venue,
    setSan: value => {
      venue = value;
    },
    registerSanCommand: false,
    registerClearCommand: false,
  });

  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/san')),
    false
  );
  assert.equal(
    mock.handlers.some(({ pattern }) => pattern.test('/clearsan')),
    false
  );
});

test('legacy /clearsan can still use an injected persistent venue', async () => {
  const mock = createMockBot();
  const sanCommand = loadSanCommand(mock.bot);
  let venue = 'Sân số 8';

  sanCommand({
    getSan: () => venue,
    setSan: value => {
      venue = value;
    },
    registerSanCommand: false,
  });

  await invokeCommand(mock.handlers, '/clearsan');

  assert.equal(venue, null);
  assert.equal(mock.sentMessages.at(-1).message, '✅ Đã xóa sân.');
});
