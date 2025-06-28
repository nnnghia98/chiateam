require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Get bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please create a .env file with your bot token:');
  console.error('TELEGRAM_BOT_TOKEN=your_bot_token_here');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Store members who typed /addme
const members = new Map();

// Store last member list before split
// eslint-disable-next-line prefer-const
let lastMembersBeforeSplit = new Map();

// Store current groups after split
// eslint-disable-next-line prefer-const
let groupA = [];
// eslint-disable-next-line prefer-const
let groupB = [];

// Import commands
const startCommand = require('./commands/start');
const addMeCommand = require('./commands/addme');
const splitCommand = require('./commands/split');
const unSplitCommand = require('./commands/unsplit');
const listCommand = require('./commands/list');
const removeCommand = require('./commands/remove');
const resetCommand = require('./commands/reset');
const addListCommand = require('./commands/addlist');
const switchCommand = require('./commands/switch');
const unknownCommand = require('./commands/unknown');
const menuCommand = require('./commands/menu');
const teamsCommand = require('./commands/teams');

// Initialize all commands
startCommand(bot);
addMeCommand(bot, members);
splitCommand(bot, members, lastMembersBeforeSplit, groupA, groupB);
unSplitCommand(bot, members, lastMembersBeforeSplit);
listCommand(bot, members);
removeCommand(bot, members);
resetCommand(bot, members);
addListCommand(bot, members);
switchCommand(bot, groupA, groupB);
unknownCommand(bot);
menuCommand(bot);
teamsCommand(bot, groupA, groupB);

// Handle callback queries from inline keyboards
bot.on('callback_query', callbackQuery => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const opts = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
  };

  let text;

  switch (action) {
    case 'addme': {
      // Call the addMe command logic
      const userId = callbackQuery.from.id;
      const name =
        callbackQuery.from.first_name +
        (callbackQuery.from.username
          ? ` (@${callbackQuery.from.username})`
          : '');

      if (members.has(userId)) {
        text = `⚠️ Có ${name} rồi`;
      } else {
        members.set(userId, name);
        text = `✅ ${name} đã được thêm vào /list`;
      }
      break;
    }

    case 'list': {
      // Call the list command logic
      if (members.size === 0) {
        text = '/list trống';
      } else {
        const names = Array.from(members.values());
        text = `👥 Danh sách hiện tại:\n${names.join('\n')}`;
      }
      break;
    }

    case 'split': {
      // Call the split command logic
      if (members.size < 2) {
        text = '❗ Không đủ người để chia';
      } else {
        lastMembersBeforeSplit = new Map(members);
        const names = Array.from(members.values());
        const shuffleArray = require('./utils/shuffle');
        shuffleArray(names);

        const half = Math.ceil(names.length / 2);
        groupA.length = 0;
        groupB.length = 0;
        groupA.push(...names.slice(0, half));
        groupB.push(...names.slice(half));

        text = `🎲 *Chia team* 🎲\n\n👤 *Team A:*\n${groupA.join('\n')}\n\n👤 *Team B:*\n${groupB.join('\n')}`;
      }
      break;
    }

    case 'reset': {
      // Call the reset command logic
      if (members.size === 0) {
        text = '📝 /list trống';
      } else {
        members.clear();
        text = '✅ /list đã được xóa';
      }
      break;
    }

    case 'unsplit': {
      // Call the unsplit command logic
      if (lastMembersBeforeSplit.size === 0) {
        text = '⚠️ Không có danh sách trước đó để khôi phục';
      } else {
        members.clear();
        for (const [id, name] of lastMembersBeforeSplit) {
          members.set(id, name);
        }
        text = '✅ Danh sách đã được khôi phục đến trạng thái trước khi chia';
      }
      break;
    }

    case 'teams': {
      // Call the teams command logic
      if (groupA.length === 0 && groupB.length === 0) {
        text = '⚠️ Chưa có team nào được chia. Dùng /split trước';
      } else {
        text = `🎲 *Teams hiện tại* 🎲\n\n👤 *Team A:*\n${groupA.join('\n')}\n\n👤 *Team B:*\n${groupB.join('\n')}`;
      }
      break;
    }

    default:
      return;
  }

  if (text) {
    bot.editMessageText(text, opts);
  }
});

console.log('🤖 Bot is running...');
