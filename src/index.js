const {
  startCommand,
  addMeCommand,
  addCommand,
  listCommand,
  chiateamCommand,
  teamCommand,
  removeCommand,
  resetCommand,
  addToTeam1Command,
  addToTeam2Command,
  resetTeamCommand,
  unknownCommand,
  tiensanCommand,
  chiaTienCommand,
  taoVoteCommand,
  leaderboardCommand,
  updateLeaderboardCommand,
  editStatsCommand,
  playerCommand,
  registerCommand,
  sanCommand,
  resetTeam1Command,
  resetTeam2Command,
} = require('./commands');

const maintenanceMessage = require('./commands/maintainance');

// Maintenance mode check
const isMaintenanceMode = true; // Set to true to enable maintenance mode
const maintenanceUntil = '2026-10-02 12:00'; // Set maintenance end time

if (isMaintenanceMode) {
  const bot = require('./bot');

  bot.on('message', msg => {
    if (msg.text && msg.text.startsWith('/')) {
      const { sendMessage } = require('./utils/chat');
      sendMessage(msg, 'DEFAULT', maintenanceMessage(maintenanceUntil), {
        parse_mode: 'Markdown',
      });
    }
  });

  console.log('🔧 Bot is in maintenance mode...');
  return;
}

const members = new Map();

const teamA = new Map();
const teamB = new Map();

let tiensan = null;

startCommand();
unknownCommand();
addMeCommand(members);
chiateamCommand(members, teamA, teamB);
resetTeamCommand(members, teamA, teamB);
listCommand(members);
removeCommand(members);
resetCommand(members);
addCommand(members);
teamCommand(teamA, teamB);
tiensanCommand(
  () => tiensan,
  val => {
    tiensan = val;
  }
);
chiaTienCommand(() => tiensan, teamA, teamB);
taoVoteCommand();
addToTeam1Command(members, teamA);
addToTeam2Command(members, teamB);
sanCommand();
leaderboardCommand();
updateLeaderboardCommand();
editStatsCommand();
playerCommand();
// registerCommand();
resetTeam1Command(teamA, members);
resetTeam2Command(teamB, members);

console.log('🤖 Bot is running...');
