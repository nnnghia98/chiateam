require('../config/load-env').loadEnv();

const { callbackQueryCommand, taoVoteCommand } = require('./commands');

const maintenanceMessage = require('./commands/maintainance');
const bot = require('./telegram-client');
const { logCommandUsage } = require('./utils/command-logger');
const { logEvent } = require('./utils/logger');
const { initializeStorage } = require('./utils/storage');
const { startBotRuntime } = require('../runtime/start-bot');
const {
  createApiStateRepository,
} = require('../runtime/repositories/api-state-repository');
const {
  createCommandDefinitions,
} = require('../runtime/create-command-definitions');
const {
  createTelegramBenchIdentityPolicy,
} = require('../platforms/telegram/bench-identity-policy');
const {
  createTelegramAttendanceVotePublisher,
} = require('../platforms/telegram/attendance-vote-publisher');
const {
  createTelegramAttendanceVoteController,
} = require('../platforms/telegram/attendance-vote-controller');
const {
  createApiPlayerRepository,
} = require('../runtime/repositories/api-player-repository');
const {
  createApiStatisticsRepository,
} = require('../runtime/repositories/api-statistics-repository');
const {
  createApiMatchRepository,
} = require('../runtime/repositories/api-match-repository');
const {
  createApiMatchSummaryGenerator,
} = require('../runtime/repositories/api-match-summary-generator');
const {
  createTelegramPermissionPolicy,
} = require('../platforms/telegram/permission-policy');
const {
  registerCallbackQueryHandler,
} = require('./commands/common/callback-query');
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

  logEvent(
    'bot',
    'maintenance mode enabled',
    { until: maintenanceUntil },
    'warn'
  );
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
  const { bench: members } = storage;
  const getActiveVote = storage.getActiveVote;
  const setActiveVote = storage.setActiveVote;
  const stateRepository = createApiStateRepository({
    afterSave: snapshot => storage.syncFromSnapshot(snapshot),
  });
  const attendanceVotePublisher = createTelegramAttendanceVotePublisher({
    bot,
  });
  const attendanceVoteController = createTelegramAttendanceVoteController({
    bot,
  });
  const playerRepository = createApiPlayerRepository();
  const statisticsRepository = createApiStatisticsRepository();
  const matchRepository = createApiMatchRepository();
  const matchSummaryGenerator = createApiMatchSummaryGenerator();

  // New platform-independent commands use this runtime. Commands that are not
  // registered here continue to use their legacy handlers below.
  startBotRuntime({
    bot,
    stateRepository,
    permissionPolicy: createTelegramPermissionPolicy(),
    registerTelegramActionHandler: registerCallbackQueryHandler,
    definitions: createCommandDefinitions({
      benchIdentityPolicy: createTelegramBenchIdentityPolicy(),
      votePublisher: attendanceVotePublisher,
      voteController: attendanceVoteController,
      playerRepository,
      statisticsRepository,
      matchRepository,
      matchSummaryGenerator,
    }),
  });

  // Keep only Telegram poll-answer ingestion as a temporary platform event.
  // Every slash command is registered through the shared command runtime.
  taoVoteCommand({
    members,
    getActiveVote,
    setActiveVote,
    registerCreateCommand: false,
    registerCountCommand: false,
    registerClearCommand: false,
    registerSyncCommand: false,
  });
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
