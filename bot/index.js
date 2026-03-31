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
  registerCommand,
  playersCommand,
  sanCommand,
  addToTeamCommand,
  clearTeamCommand,
  meCommand,
  matchCommand,
  matchesCommand,
  resetCommand,
  aiCommand,
} = require('./commands');

const maintenanceMessage = require('./commands/maintainance');
const bot = require('./bot');
const { logCommandUsage } = require('./utils/command-logger');
const { startTestServer } = require('./test-server');
const { initializeStorage } = require('./utils/storage');

function installProcessCrashLogging() {
  process.on('uncaughtException', err => {
    console.error('💥 uncaughtException:', err);
  });

  process.on('unhandledRejection', reason => {
    console.error('💥 unhandledRejection:', reason);
  });

  process.on('SIGTERM', () => {
    console.error('🛑 Received SIGTERM, shutting down...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.error('🛑 Received SIGINT, shutting down...');
    process.exit(0);
  });
}

installProcessCrashLogging();

// Maintenance mode check
const isMaintenanceMode = false; // Set to true to enable maintenance mode
const maintenanceUntil = '2026-10-02 12:00'; // Set maintenance end time

if (isMaintenanceMode) {
  bot.on('message', msg => {
    if (msg.text && msg.text.startsWith('/')) {
      const { sendMessage } = require('./utils/chat');
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: maintenanceMessage(maintenanceUntil),
        options: {
          parse_mode: 'Markdown',
        },
      });
    }
  });

  console.log('🔧 Bot is in maintenance mode...');
  return;
}

// Global command usage logging (for all `/...` commands)
if (bot) {
  bot.on('message', msg => {
    logCommandUsage(msg);
  });
}

// Initialize persistent storage (loads from storage.json if exists)
const storage = initializeStorage();
const { bench: members, teamA, teamB, team3A, team3B, team3C } = storage;
const getTiensan = storage.getTiensan;
const setTiensan = storage.setTiensan;
const getTiennuoc = storage.getTiennuoc;
const setTiennuoc = storage.setTiennuoc;
const getTeamThua = storage.getTeamThua;
const setTeamThua = storage.setTeamThua;
const getActiveVote = storage.getActiveVote;
const setActiveVote = storage.setActiveVote;
const resetAll = storage.resetAll;

startCommand();
unknownCommand();

addMeCommand({ members });
chiateamCommand({ members, teamA, teamB, team3A, team3B, team3C });
benchCommand({ members });
clearBenchCommand({ members });
addCommand({ members });
teamCommand({ teamA, teamB, team3A, team3B, team3C });
tiensanCommand(getTiensan, setTiensan);
chiaTienCommand(getTiensan, getTeamThua, { teamA, teamB });
taoVoteCommand({ members, getActiveVote, setActiveVote });
sanCommand();
leaderboardCommand();
updateLeaderboardCommand();
editStatsCommand();
playerCommand();
registerCommand();
playersCommand();
addToTeamCommand({ members, teamA, teamB, team3A, team3B, team3C });
clearTeamCommand({ teamA, teamB, team3A, team3B, team3C });
meCommand();
matchCommand({ getTiensan, teamA, teamB, team3C });
matchesCommand();
resetCommand({ resetAll });
aiCommand();

// Start HTTP test server in development mode
startTestServer(bot);

console.log('🤖 Bot is running...');
