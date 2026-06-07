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
