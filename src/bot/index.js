const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');
dotenv.config();
// dotenv.config({
//   path: process.env.NODE_ENV === 'production' ? '.env' : '.env.dev',
// });
// console.log('Running mode:', process.env.NODE_ENV);

// Get bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please create a .env file with your bot token:');
  console.error('TELEGRAM_BOT_TOKEN=your_bot_token_here');
  process.exit(1);
}

let bot;

try {
  bot = new TelegramBot(token, { polling: true });

  // Handle polling errors
  bot.on('polling_error', error => {
    console.error('❌ Telegram Bot polling error:', error.message);
    console.error('Error details:', error);
  });

  // Handle webhook errors
  bot.on('webhook_error', error => {
    console.error('❌ Telegram Bot webhook error:', error.message);
    console.error('Error details:', error);
  });

  console.log('✅ Telegram Bot initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Telegram Bot:', error.message);
  console.error('Error details:', error);
  // Don't exit the process, just export null so the app can continue
  bot = null;
}

module.exports = bot;
