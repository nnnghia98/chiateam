const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please configure TELEGRAM_BOT_TOKEN before starting the bot.');
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
    console.error('❌ Telegram Bot polling error:', error.message);
    console.error('Error details:', error);
  });

  bot.on('webhook_error', error => {
    console.error('❌ Telegram Bot webhook error:', error.message);
    console.error('Error details:', error);
  });

  console.log('✅ Telegram Bot initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Telegram Bot:', error.message);
  console.error('Error details:', error);
  bot = null;
}

module.exports = bot;
