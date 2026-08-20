const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_OWNER_ID = '123';

function loadManifestWithMockedBot(mockBot, registeredCallbacks = []) {
  const commandPath = require.resolve('./manifest');
  const chatPath = require.resolve('../../utils/chat');
  const telegramClientPath = require.resolve('../../telegram-client');
  const callbackQueryPath = require.resolve('../common/callback-query');

  delete require.cache[commandPath];
  delete require.cache[chatPath];
  delete require.cache[telegramClientPath];
  delete require.cache[callbackQueryPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  require.cache[callbackQueryPath] = {
    id: callbackQueryPath,
    filename: callbackQueryPath,
    loaded: true,
    exports: {
      registerCallbackQueryHandler(handler) {
        registeredCallbacks.push(handler);
      },
    },
  };

  return require('./manifest');
}

function createMockBot() {
  const handlers = [];
  const sentMessages = [];
  const answeredCallbacks = [];
  const editedReplyMarkups = [];

  return {
    handlers,
    sentMessages,
    answeredCallbacks,
    editedReplyMarkups,
    bot: {
      onText(pattern, handler) {
        handlers.push({ pattern, handler });
      },
      async sendMessage(chatId, message, options) {
        sentMessages.push({ chatId, message, options });
        return { ok: true };
      },
      async answerCallbackQuery(id, options) {
        answeredCallbacks.push({ id, options });
        return { ok: true };
      },
      async editMessageReplyMarkup(replyMarkup, options) {
        editedReplyMarkups.push({ replyMarkup, options });
        return { ok: true };
      },
    },
  };
}

async function invokeCommand(handlers, command) {
  const handler = handlers.find(({ pattern }) => pattern.test(command));
  assert.ok(handler, `Missing handler for ${command}`);

  return handler.handler(
    {
      from: { id: 123 },
      chat: { id: 456 },
      text: command,
    },
    command.match(handler.pattern)
  );
}

async function invokeCallback(callbackHandler, data, messageId) {
  return callbackHandler({
    id: `callback-${messageId}`,
    data,
    from: { id: 123 },
    message: {
      chat: { id: 456 },
      message_id: messageId,
    },
  });
}

test('/mf shows the current manifest without bench instructions', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);

  manifestCommand({
    members: new Map(),
    getManifest: () => [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Alice' },
          { identity: 'tele:2', name: 'Bob' },
        ],
      },
      {
        relation: 'different',
        players: [
          { identity: 'tele:3', name: 'Carol' },
          { identity: 'tele:4', name: 'Dan' },
        ],
      },
    ],
    setManifest: () => {},
  });

  await invokeCommand(handlers, '/mf');

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /\*Danh sách manifest:\*/);
  assert.match(sentMessages[0].message, /1\. `Alice <3 Bob`/);
  assert.match(sentMessages[0].message, /2\. `Carol <\/3 Dan`/);
  assert.doesNotMatch(sentMessages[0].message, /Bench hiện tại/);
});

test('/manifests shows an empty state when no manifest exists', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);

  manifestCommand({
    members: new Map(),
    getManifest: () => null,
    setManifest: () => {},
  });

  await invokeCommand(handlers, '/manifests');

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, 'Chưa có manifest nào.');
});

test('legacy manifest handler can leave migrated commands to shared runtime', () => {
  const { bot, handlers } = createMockBot();
  const registeredCallbacks = [];
  const manifestCommand = loadManifestWithMockedBot(bot, registeredCallbacks);

  manifestCommand({
    members: new Map(),
    getManifest: () => null,
    setManifest: () => {},
    registerListCommands: false,
    registerManifestCommands: false,
    registerRemoveCommands: false,
    registerClearCommands: false,
  });

  assert.equal(
    handlers.some(({ pattern }) => pattern.test('/manifests')),
    false
  );
  assert.equal(
    handlers.some(({ pattern }) => pattern.test('/mf')),
    false
  );
  assert.equal(
    handlers.some(({ pattern }) => pattern.test('/manifest')),
    false
  );
  assert.equal(
    handlers.some(({ pattern }) => pattern.test('/removemanifest')),
    false
  );
  assert.equal(
    handlers.some(({ pattern }) => pattern.test('/clearmanifests')),
    false
  );
  assert.equal(registeredCallbacks.length, 0);
});

test('/manifest shows inline buttons instead of bench list', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);

  manifestCommand({
    members: new Map([
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ]),
    getManifest: () => null,
    setManifest: () => {},
  });

  await invokeCommand(handlers, '/manifest');

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /Chọn member đầu tiên/);
  assert.doesNotMatch(sentMessages[0].message, /1\. Alice/);
  assert.deepEqual(sentMessages[0].options.reply_markup.inline_keyboard, [
    [{ text: '1. Alice', callback_data: 'manifest:first:0' }],
    [{ text: '2. Bob', callback_data: 'manifest:first:1' }],
  ]);
});

test('/manifest inline flow saves the selected second member', async () => {
  const { bot, handlers, sentMessages, editedReplyMarkups } = createMockBot();
  const registeredCallbacks = [];
  const manifestCommand = loadManifestWithMockedBot(bot, registeredCallbacks);
  let savedManifest = null;

  manifestCommand({
    members: new Map([
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ]),
    getManifest: () => savedManifest,
    setManifest: value => {
      savedManifest = value;
    },
  });

  assert.equal(registeredCallbacks.length, 1);
  const callbackHandler = registeredCallbacks[0];

  await invokeCommand(handlers, '/manifest');
  await invokeCallback(callbackHandler, 'manifest:first:0', 1);

  const relationButton =
    sentMessages[1].options.reply_markup.inline_keyboard[0][0];
  assert.equal(relationButton.callback_data, 'manifest:relation:0:same');
  await invokeCallback(callbackHandler, relationButton.callback_data, 2);

  assert.deepEqual(
    sentMessages[2].options.reply_markup.inline_keyboard.map(row =>
      row.map(button => button.text)
    ),
    [['2. Bob']]
  );
  const secondMemberButton =
    sentMessages[2].options.reply_markup.inline_keyboard[0][0];
  assert.equal(secondMemberButton.callback_data, 'manifest:second:0:same:1');
  await invokeCallback(callbackHandler, secondMemberButton.callback_data, 3);

  assert.deepEqual(savedManifest, [
    {
      relation: 'same',
      players: [
        { identity: 'tele:1', name: 'Alice' },
        { identity: 'tele:2', name: 'Bob' },
      ],
    },
  ]);
  assert.match(sentMessages[3].message, /Alice <3 Bob/);
  assert.deepEqual(
    editedReplyMarkups.map(({ replyMarkup, options }) => ({
      replyMarkup,
      messageId: options.message_id,
    })),
    [
      { replyMarkup: { inline_keyboard: [] }, messageId: 1 },
      { replyMarkup: { inline_keyboard: [] }, messageId: 2 },
      { replyMarkup: { inline_keyboard: [] }, messageId: 3 },
    ]
  );
});

test('/removemanifest shows inline buttons for existing manifests', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);

  manifestCommand({
    members: new Map(),
    getManifest: () => [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Alice' },
          { identity: 'tele:2', name: 'Bob' },
        ],
      },
    ],
    setManifest: () => {},
  });

  await invokeCommand(handlers, '/removemanifest');

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, '📋 Chọn manifest cần xóa:');
  assert.deepEqual(sentMessages[0].options.reply_markup.inline_keyboard, [
    [{ text: '1. Alice <3 Bob', callback_data: 'manifestremove:remove:0' }],
  ]);
});

test('/manifest accepts 💔 as a different-team relation', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let savedManifest = null;

  manifestCommand({
    members: new Map([
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ]),
    getManifest: () => null,
    setManifest: value => {
      savedManifest = value;
    },
  });

  await invokeCommand(handlers, '/manifest 1 💔 2');

  assert.equal(savedManifest.length, 1);
  assert.equal(savedManifest[0].relation, 'different');
  assert.deepEqual(
    savedManifest[0].players.map(player => player.name),
    ['Alice', 'Bob']
  );
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /Alice 💔 Bob/);
});

test('/manifest adds multiple valid manifests', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let savedManifest = null;

  manifestCommand({
    members: new Map([
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
      [3, { name: 'Carol', userId: 3 }],
      [4, { name: 'Dan', userId: 4 }],
    ]),
    getManifest: () => savedManifest,
    setManifest: value => {
      savedManifest = value;
    },
  });

  await invokeCommand(handlers, '/manifest 1 <3 2');
  await invokeCommand(handlers, '/manifest 3 💔 4');

  assert.equal(savedManifest.length, 2);
  assert.deepEqual(
    savedManifest.map(manifest => manifest.relation),
    ['same', 'different']
  );
  assert.equal(sentMessages.length, 2);
});

test('/manifest replaces an existing pair with the latest relation', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let savedManifest = null;

  manifestCommand({
    members: new Map([
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
    ]),
    getManifest: () => savedManifest,
    setManifest: value => {
      savedManifest = value;
    },
  });

  await invokeCommand(handlers, '/manifest 1 <3 2');
  await invokeCommand(handlers, '/manifest 1 </3 2');

  assert.equal(savedManifest.length, 1);
  assert.equal(savedManifest[0].relation, 'different');
  assert.match(sentMessages[1].message, /Đã cập nhật nguyện vọng/);
});

test('/manifest rejects contradictory manifest sets', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let savedManifest = null;
  let setManifestCount = 0;

  manifestCommand({
    members: new Map([
      [1, { name: 'Alice', userId: 1 }],
      [2, { name: 'Bob', userId: 2 }],
      [3, { name: 'Carol', userId: 3 }],
    ]),
    getManifest: () => savedManifest,
    setManifest: value => {
      setManifestCount++;
      savedManifest = value;
    },
  });

  await invokeCommand(handlers, '/manifest 1 <3 2');
  await invokeCommand(handlers, '/manifest 2 <3 3');
  await invokeCommand(handlers, '/manifest 1 💔 3');

  assert.equal(setManifestCount, 2);
  assert.equal(savedManifest.length, 2);
  assert.match(sentMessages[2].message, /mâu thuẫn/);
});

test('/removemanifest removes a single manifest by list number', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let currentManifest = [
    {
      relation: 'same',
      players: [
        { identity: 'tele:1', name: 'Alice' },
        { identity: 'tele:2', name: 'Bob' },
      ],
    },
    {
      relation: 'different',
      players: [
        { identity: 'tele:3', name: 'Carol' },
        { identity: 'tele:4', name: 'Dan' },
      ],
    },
  ];

  manifestCommand({
    members: new Map(),
    getManifest: () => currentManifest,
    setManifest: value => {
      currentManifest = value;
    },
  });

  await invokeCommand(handlers, '/removemanifest 1');

  assert.equal(currentManifest.length, 1);
  assert.equal(currentManifest[0].players[0].name, 'Carol');
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /Đã xóa manifest/);
  assert.match(sentMessages[0].message, /Alice <3 Bob/);
});

test('/removemanifest reports invalid selections', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);

  manifestCommand({
    members: new Map(),
    getManifest: () => [
      {
        relation: 'same',
        players: [
          { identity: 'tele:1', name: 'Alice' },
          { identity: 'tele:2', name: 'Bob' },
        ],
      },
    ],
    setManifest: () => {},
  });

  await invokeCommand(handlers, '/removemanifest 2');

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].message, /Số thứ tự manifest không hợp lệ/);
});

test('/clearmanifests resets the current manifest only', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let currentManifest = {
    relation: 'different',
    players: [
      { identity: 'tele:1', name: 'Alice' },
      { identity: 'tele:2', name: 'Bob' },
    ],
  };

  manifestCommand({
    members: new Map([[1, { name: 'Alice', userId: 1 }]]),
    getManifest: () => currentManifest,
    setManifest: value => {
      currentManifest = value;
    },
  });

  await invokeCommand(handlers, '/clearmanifests');

  assert.equal(currentManifest, null);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, '✅ Đã xóa tất cả manifest.');
});

test('/clearmanifests reports empty state when there is no manifest', async () => {
  const { bot, handlers, sentMessages } = createMockBot();
  const manifestCommand = loadManifestWithMockedBot(bot);
  let setManifestCalled = false;

  manifestCommand({
    members: new Map([[1, { name: 'Alice', userId: 1 }]]),
    getManifest: () => null,
    setManifest: () => {
      setManifestCalled = true;
    },
  });

  await invokeCommand(handlers, '/clearmanifests');

  assert.equal(setManifestCalled, false);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].message, 'Chưa có manifest nào.');
});
