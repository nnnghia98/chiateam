const {
  startCommand,
  addMeCommand,
  addCommand,
  benchCommand,
  chiateamCommand,
  teamCommand,
  clearBenchCommand,
  unknownCommand,
  tiensanCommand,
  chiaTienCommand,
  taoVoteCommand,
  leaderboardCommand,
  updateLeaderboardCommand,
  editStatsCommand,
  playerCommand,
  // registerCommand,
  sanCommand,
  addToTeamCommand,
  clearTeamCommand,
} = require('./commands');

const maintenanceMessage = require('./commands/maintainance');

// Maintenance mode check
const isMaintenanceMode = false; // Set to true to enable maintenance mode
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

addMeCommand({ members });
chiateamCommand({ members, teamA, teamB });
benchCommand({ members });
clearBenchCommand({ members });
addCommand({ members });
teamCommand(teamA, teamB);
tiensanCommand(
  () => tiensan,
  val => {
    tiensan = val;
  }
);
chiaTienCommand(() => tiensan, teamA, teamB);
taoVoteCommand();
sanCommand();
leaderboardCommand();
updateLeaderboardCommand();
editStatsCommand();
playerCommand();
// registerCommand();
addToTeamCommand({ members, teamA, teamB });
clearTeamCommand({ teamA, teamB, members });

console.log('🤖 Bot is running...');
