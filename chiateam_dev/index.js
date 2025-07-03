require('dotenv').config();

const bot = require('./bot/init');

const startCommand = require('./commands/start');
const addMeCommand = require('./commands/addme');
const addCommand = require('./commands/add');
const listCommand = require('./commands/list');
const splitCommand = require('./commands/split');
const teamCommand = require('./commands/team');
const removeCommand = require('./commands/remove');
const resetCommand = require('./commands/reset');
const addToTeam1Command = require('./commands/addtoteam1');
const addToTeam2Command = require('./commands/addtoteam2');
const resetTeamCommand = require('./commands/resetteam');
const unknownCommand = require('./commands/unknown');
const tiensanCommand = require('./commands/tiensan');
const chiatienCommand = require('./commands/chiatien');

// Store members who typed /addme
const members = new Map();

// Store current groups after split
const teamA = new Map();
const teamB = new Map();

// Store tiensan
let tiensan = null;

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
splitCommand(bot, members, teamA, teamB);
resetTeamCommand(bot, members, teamA, teamB);
listCommand(bot, members);
removeCommand(bot, members);
resetCommand(bot, members);
addCommand(bot, members);
teamCommand(bot, teamA, teamB);
tiensanCommand(
  bot,
  () => tiensan,
  val => {
    tiensan = val;
  }
);
chiatienCommand(bot, () => tiensan, teamA, teamB);
unknownCommand(bot);
addToTeam1Command(bot, members, teamA);
addToTeam2Command(bot, members, teamB);

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
