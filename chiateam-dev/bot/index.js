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

const bot = new TelegramBot(token, { polling: true });

module.exports = bot;
