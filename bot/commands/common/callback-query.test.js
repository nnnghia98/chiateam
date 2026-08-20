const test = require('node:test');
const assert = require('node:assert/strict');

function loadCallbackQueryWithMockedBot(mockBot) {
  const commandPath = require.resolve('./callback-query');
  const telegramClientPath = require.resolve('../../telegram-client');

  delete require.cache[commandPath];
  delete require.cache[telegramClientPath];

  require.cache[telegramClientPath] = {
    id: telegramClientPath,
    filename: telegramClientPath,
    loaded: true,
    exports: mockBot,
  };

  return require('./callback-query');
}

test('unsupported inline callbacks are answered', async () => {
  const calls = [];
  const mockBot = {
    async answerCallbackQuery(id, options) {
      calls.push({ id, options });
      return { ok: true };
    },
  };

  const { handleUnsupportedCallback } = loadCallbackQueryWithMockedBot(mockBot);

  await handleUnsupportedCallback({
    id: 'callback-1',
    data: 'old-action',
    from: { id: 123, first_name: 'Nghia' },
    message: { chat: { id: -100 }, message_id: 456 },
  });

  assert.deepEqual(calls, [
    {
      id: 'callback-1',
      options: {
        text: '⚠️ Nút này hiện không còn được hỗ trợ. Dùng /start để xem lệnh hiện có.',
        show_alert: false,
      },
    },
  ]);
});

test('registered callback handlers prevent unsupported response', async () => {
  const calls = [];
  const registered = [];
  const mockBot = {
    on(event, handler) {
      registered.push({ event, handler });
    },
    async answerCallbackQuery(id, options) {
      calls.push({ id, options });
      return { ok: true };
    },
  };

  const callbackQueryCommand = loadCallbackQueryWithMockedBot(mockBot);
  const { registerCallbackQueryHandler } = callbackQueryCommand;

  registerCallbackQueryHandler(async query => query.data === 'handled-action');
  callbackQueryCommand();

  const callbackListener = registered.find(
    call => call.event === 'callback_query'
  );
  assert.ok(callbackListener);

  await callbackListener.handler({
    id: 'callback-2',
    data: 'handled-action',
    from: { id: 123, first_name: 'Nghia' },
    message: { chat: { id: -100 }, message_id: 456 },
  });

  assert.deepEqual(calls, []);
});

test('registered callback handlers can be removed', async () => {
  const calls = [];
  const registered = [];
  const mockBot = {
    on(event, handler) {
      registered.push({ event, handler });
    },
    async answerCallbackQuery(id, options) {
      calls.push({ id, options });
      return { ok: true };
    },
  };

  const callbackQueryCommand = loadCallbackQueryWithMockedBot(mockBot);
  const { registerCallbackQueryHandler } = callbackQueryCommand;
  const unregister = registerCallbackQueryHandler(async () => true);

  unregister();
  unregister();
  callbackQueryCommand();

  const callbackListener = registered.find(
    call => call.event === 'callback_query'
  );
  await callbackListener.handler({
    id: 'callback-3',
    data: 'removed-action',
    from: { id: 123, first_name: 'Nghia' },
    message: { chat: { id: -100 }, message_id: 456 },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'callback-3');
});
