require('../config/load-env').loadEnv();
const {
  shouldDelegate,
  startManagedSupervisor,
  sendReady,
} = require('../runtime/managed-bootstrap');
const { safeError } = require('../runtime/managed-process');

if (shouldDelegate()) {
  startManagedSupervisor({ service: 'telegram', entrypoint: __filename });
  return;
}

const { callbackQueryCommand, taoVoteCommand } = require('./commands');

const maintenanceMessage = require('./commands/maintainance');
const bot = require('./telegram-client');
const { logCommandUsage } = require('./utils/command-logger');
const { registerMentionLogger } = require('./utils/mention-logger');
const {
  createJevIntentRouter,
} = require('../platforms/telegram/jev-intent-router');
const {
  getReplyKeyboardAction,
} = require('../platforms/telegram/reply-keyboard');
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
  createApiMatchRepository,
} = require('../runtime/repositories/api-match-repository');
const {
  createApiMatchSummaryGenerator,
} = require('../runtime/repositories/api-match-summary-generator');
const {
  createTelegramPermissionPolicy,
} = require('../platforms/telegram/permission-policy');
const {
  createZaloBroadcastService,
} = require('../platforms/zalo/broadcast-service');
const {
  createTelegramPhotoUploadService,
} = require('../platforms/telegram/photo-upload-service');
const {
  createApiZaloAnnouncementRepository,
} = require('../runtime/repositories/api-zalo-announcement-repository');
const {
  registerCallbackQueryHandler,
} = require('./commands/common/callback-query');
const {
  isMaintenanceModeEnabled,
  getMaintenanceUntil,
} = require('../config/maintenance');
const {
  syncTelegramCommandMenu,
  TELEGRAM_ALLOWED_SLASH_COMMANDS,
} = require('../platforms/telegram/command-menu');

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

const botIdentityReady = bot.getMe().then(identity => {
  registerMentionLogger(bot, identity, {
    replyToMentions:
      !process.env.TYPESAFE_API_KEY ||
      process.env.TELEGRAM_JEV_ENABLED === 'false',
  });
  return identity;
});
// Attach a rejection handler while storage initialization is still running.
botIdentityReady.catch(error => {
  logEvent(
    'telegram.mention',
    'failed to load bot identity',
    {
      error: safeError(error).message,
    },
    'error'
  );
  process.exit(1);
});

callbackQueryCommand();

// Maintenance mode check
const isMaintenanceMode = isMaintenanceModeEnabled();
const maintenanceUntil = getMaintenanceUntil();

if (isMaintenanceMode) {
  bot.on('message', msg => {
    if (
      msg.text &&
      (/^\/start(?:@\w+)?(?:\s|$)/i.test(msg.text) ||
        getReplyKeyboardAction(msg.text))
    ) {
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
  Promise.all([syncTelegramCommandMenu(bot), botIdentityReady])
    .then(() => sendReady('telegram'))
    .catch(() => process.exit(1));
  return;
}

// Log /start and reply-keyboard actions.
if (bot) {
  bot.on('message', msg => {
    const keyboardAction = getReplyKeyboardAction(msg.text);
    const actionText = keyboardAction
      ? `/${keyboardAction.command}${
          keyboardAction.args.length > 0
            ? ` ${keyboardAction.args.join(' ')}`
            : ''
        }`
      : msg.text;
    logCommandUsage({ ...msg, text: actionText });
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
  const naturalLanguage = createJevIntentRouter({
    identity: await botIdentityReady,
    stateRepository,
  });
  const attendanceVotePublisher = createTelegramAttendanceVotePublisher({
    bot,
  });
  const attendanceVoteController = createTelegramAttendanceVoteController({
    bot,
  });
  const zaloAnnouncementRepository = createApiZaloAnnouncementRepository();
  const zaloBroadcastService = createZaloBroadcastService({
    repository: zaloAnnouncementRepository,
    imageUploader: createTelegramPhotoUploadService({
      bot,
      repository: zaloAnnouncementRepository,
    }),
  });
  const playerRepository = createApiPlayerRepository();
  const matchRepository = createApiMatchRepository();
  const matchSummaryGenerator = createApiMatchSummaryGenerator();

  // New platform-independent commands use this runtime. Commands that are not
  // registered here continue to use their legacy handlers below.
  startBotRuntime({
    bot,
    naturalLanguage,
    stateRepository,
    permissionPolicy: createTelegramPermissionPolicy(),
    registerTelegramActionHandler: registerCallbackQueryHandler,
    allowedSlashCommands: TELEGRAM_ALLOWED_SLASH_COMMANDS,
    definitions: createCommandDefinitions({
      broadcastService: zaloBroadcastService,
      benchIdentityPolicy: createTelegramBenchIdentityPolicy(),
      votePublisher: attendanceVotePublisher,
      voteController: attendanceVoteController,
      playerRepository,
      matchRepository,
      matchSummaryGenerator,
    }),
  });

  // Keep only Telegram poll-answer ingestion as a temporary platform event.
  // The public command menu exposes /start; admin broadcasts also accept
  // /zalosay and /say. Other actions use the reply keyboard.
  taoVoteCommand({
    members,
    getActiveVote,
    setActiveVote,
    getLatestActiveVote: async () => {
      const state = await stateRepository.load(['activeVote']);
      return state.activeVote;
    },
    persistActiveVote: activeVote => stateRepository.save({ activeVote }),
    registerCreateCommand: false,
    registerCountCommand: false,
    registerClearCommand: false,
    registerSyncCommand: false,
  });
  logEvent('bot', 'running', {}, 'success');
  await syncTelegramCommandMenu(bot);
  await botIdentityReady;
  sendReady('telegram');
}

bootstrapBot().catch(error => {
  logEvent(
    'bot',
    'failed to initialize storage',
    { error: safeError(error).message },
    'error'
  );
  process.exit(1);
});
