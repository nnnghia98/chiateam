require('../config/load-env').loadEnv();

const {
  startCommand,
  callbackQueryCommand,
  addMeCommand,
  addCommand,
  benchCommand,
  editBenchCommand,
  chiateamCommand,
  manifestCommand,
  teamCommand,
  clearBenchCommand,
  tiensanCommand,
  tiennuocCommand,
  teamThuaCommand,
  chiaTienCommand,
  taoVoteCommand,
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
} = require('./commands');

const maintenanceMessage = require('./commands/maintainance');
const bot = require('./telegram-client');
const { logCommandUsage } = require('./utils/command-logger');
const { logEvent } = require('./utils/logger');
const { initializeStorage } = require('./utils/storage');
const {
  isMaintenanceModeEnabled,
  getMaintenanceUntil,
} = require('../config/maintenance');

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

logEvent('bot', 'starting ChiaTeam bot');

callbackQueryCommand();

// Maintenance mode check
const isMaintenanceMode = isMaintenanceModeEnabled();
const maintenanceUntil = getMaintenanceUntil();

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

  logEvent('bot', 'maintenance mode enabled', { until: maintenanceUntil }, 'warn');
  return;
}

// Global command usage logging (for all `/...` commands)
if (bot) {
  bot.on('message', msg => {
    logCommandUsage(msg);
  });
}

async function bootstrapBot() {
  // Initialize persistent storage through the API before commands start.
  const storage = await initializeStorage();
  const { bench: members, teamA, teamB, team3A, team3B, team3C } = storage;
  const getTiensan = storage.getTiensan;
  const setTiensan = storage.setTiensan;
  const getTiennuoc = storage.getTiennuoc;
  const setTiennuoc = storage.setTiennuoc;
  const getTeamThua = storage.getTeamThua;
  const setTeamThua = storage.setTeamThua;
  const getActiveVote = storage.getActiveVote;
  const setActiveVote = storage.setActiveVote;
  const getManifest = storage.getManifest;
  const setManifest = storage.setManifest;
  const refreshFromSource = storage.refreshFromSource;
  const resetAll = storage.resetAll;

  startCommand();

  addMeCommand({ members });
  chiateamCommand({
    members,
    teamA,
    teamB,
    team3A,
    team3B,
    team3C,
    getManifest,
  });
  manifestCommand({ members, getManifest, setManifest });
  benchCommand({ members, refreshFromSource });
  editBenchCommand({ members });
  clearBenchCommand({ members });
  addCommand({ members });
  teamCommand({
    teamA,
    teamB,
    team3A,
    team3B,
    team3C,
    refreshFromSource,
  });
  tiensanCommand(getTiensan, setTiensan);
  tiennuocCommand(getTiennuoc, setTiennuoc);
  teamThuaCommand({
    getTiensan,
    getTiennuoc,
    getTeamThua,
    setTeamThua,
    teamA,
    teamB,
    team3A,
    team3B,
    team3C,
  });
  chiaTienCommand(getTiensan, getTiennuoc, getTeamThua, {
    teamA,
    teamB,
    team3A,
    team3B,
    team3C,
  });
  taoVoteCommand({ members, getActiveVote, setActiveVote });
  sanCommand();
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

  logEvent('bot', 'running', {}, 'success');
}

bootstrapBot().catch(error => {
  logEvent(
    'bot',
    'failed to initialize storage',
    { error: error.message },
    'error'
  );
  process.exit(1);
});
