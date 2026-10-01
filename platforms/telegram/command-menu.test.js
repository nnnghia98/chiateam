const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TELEGRAM_BOT_COMMANDS,
  syncTelegramCommandMenu,
} = require('./command-menu');

test('Telegram publishes only /start in its slash command menu', async () => {
  const calls = [];

  await syncTelegramCommandMenu({
    async setMyCommands(commands) {
      calls.push(commands);
    },
  });

  assert.deepEqual(TELEGRAM_BOT_COMMANDS, [
    { command: 'start', description: 'Giới thiệu bot và hiện menu' },
  ]);
  assert.deepEqual(calls, [TELEGRAM_BOT_COMMANDS]);
});
