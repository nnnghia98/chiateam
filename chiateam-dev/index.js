require('dotenv').config();

const bot = require('./bot/init');

const startCommand = require('./commands/common/start');
const addMeCommand = require('./commands/add/addme');
const addCommand = require('./commands/add/add');
const listCommand = require('./commands/list/list');
const chiateamCommand = require('./commands/team/chiateam');
const teamCommand = require('./commands/team/team');
const removeCommand = require('./commands/remove/remove');
const resetCommand = require('./commands/reset/reset');
const addToTeam1Command = require('./commands/add/addtoteam1');
const addToTeam2Command = require('./commands/add/addtoteam2');
const resetTeamCommand = require('./commands/reset/resetteam');
const unknownCommand = require('./commands/common/unknown');
const tiensanCommand = require('./commands/san/tiensan');
const chiatienCommand = require('./commands/tien/chiatien');
const voteCommand = require('./commands/vote/vote');
const leaderboardCommand = require('./commands/leaderboard/leaderboard');
const updateLeaderboardCommand = require('./commands/leaderboard/update-leaderboard');
const playerStatsCommand = require('./commands/leaderboard/player-stats');

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
chiateamCommand(bot, members, teamA, teamB);
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
voteCommand(bot);
unknownCommand(bot);
addToTeam1Command(bot, members, teamA);
addToTeam2Command(bot, members, teamB);

// Initialize leaderboard commands
leaderboardCommand(bot);
updateLeaderboardCommand(bot);
playerStatsCommand(bot);

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
