require('dotenv').config();

const bot = require('./bot/init');

const startCommand = require('./commands/start');
const addMeCommand = require('./commands/addme');
const splitCommand = require('./commands/split');
const listCommand = require('./commands/list');
const removeCommand = require('./commands/remove');
const resetCommand = require('./commands/reset');
const addListCommand = require('./commands/addlist');
const teamCommand = require('./commands/team');
const unknownCommand = require('./commands/unknown');
const addToTeam1Command = require('./commands/addtoteam1');
const addToTeam2Command = require('./commands/addtoteam2');
const resetTeamCommand = require('./commands/resetteam');

// Store members who typed /addme
const members = new Map();

// Store last member list before split
const lastMembersBeforeSplit = new Map();

// Store current groups after split
const groupA = [];
const groupB = [];

bot.on('callback_query', callbackQuery => {
  const msg = callbackQuery.message;

  // Remove inline keyboard from the message
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
    }
  );

  // Acknowledge the button press
  bot.answerCallbackQuery(callbackQuery.id, { text: 'Menu cleared.' });
});

// Initialize all commands once
startCommand(bot);
addMeCommand(bot, members);
splitCommand(bot, members, lastMembersBeforeSplit, groupA, groupB);
listCommand(bot, members);
removeCommand(bot, members);
resetCommand(bot, members);
addListCommand(bot, members);
teamCommand(bot, groupA, groupB);
resetTeamCommand(bot, members, groupA, groupB);
unknownCommand(bot);
addToTeam1Command(bot, members, groupA);
addToTeam2Command(bot, members, groupB);

// // PAUSE MODE: Listen to all commands and show only a pause message
// bot.on('message', msg => {
//   if (msg.text && msg.text.startsWith('/')) {
//     bot.sendMessage(
//       msg.chat.id,
//       '🚧 Bot đang bảo trì. Vui lòng quay lại sau. EST. 17h 02/07/2025 năm dương lịch tính theo giờ Việt Nam.'
//     );
//     return;
//   }
// });

console.log('🤖 Bot is running...');
