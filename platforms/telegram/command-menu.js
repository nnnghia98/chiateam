const TELEGRAM_BOT_COMMANDS = Object.freeze([
  Object.freeze({
    command: 'start',
    description: 'Giới thiệu bot và hiện menu',
  }),
]);

async function syncTelegramCommandMenu(bot) {
  if (!bot || typeof bot.setMyCommands !== 'function') {
    throw new TypeError('Telegram bot must support setMyCommands.');
  }

  await bot.setMyCommands(TELEGRAM_BOT_COMMANDS);
}

module.exports = {
  TELEGRAM_BOT_COMMANDS,
  syncTelegramCommandMenu,
};
