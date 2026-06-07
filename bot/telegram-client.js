const TelegramBot = require('node-telegram-bot-api');
const { logEvent } = require('./utils/logger');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  logEvent(
    'telegram.client',
    'missing bot token',
    { env: 'TELEGRAM_BOT_TOKEN' },
    'error'
  );
  process.exit(1);
}

let bot;

try {
  bot = new TelegramBot(token, {
    polling: true,
    request: {
      agentOptions: {
        keepAlive: true,
        family: 4,
      },
    },
  });

  bot.on('polling_error', error => {
    logEvent(
      'telegram.client',
      'polling error',
      { error: error.message },
      'error'
    );
  });

  bot.on('webhook_error', error => {
    logEvent(
      'telegram.client',
      'webhook error',
      { error: error.message },
      'error'
    );
  });

  logEvent('telegram.client', 'initialized', {}, 'success');
} catch (error) {
  logEvent(
    'telegram.client',
    'initialization failed',
    { error: error.message },
    'error'
  );
  bot = null;
}

module.exports = bot;
