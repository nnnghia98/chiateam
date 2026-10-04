const {
  listSupportedCommandNames,
} = require('../../core/commands/command-manifest');

// Keep every supported command and alias usable, even with a small menu.
const TELEGRAM_ALLOWED_SLASH_COMMANDS = Object.freeze(
  listSupportedCommandNames().map(command => command.slice(1))
);

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
  TELEGRAM_ALLOWED_SLASH_COMMANDS,
  TELEGRAM_BOT_COMMANDS,
  syncTelegramCommandMenu,
};
