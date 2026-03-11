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
} = require('./commands');

const maintenanceMessage = require('./commands/maintainance');
const { createUiApiServer } = require('./api/server');
const bot = require('./bot');

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

const uiApi = createUiApiServer({
  getStatus: () => ({
    botInitialized: Boolean(bot),
  }),
});

uiApi
  .start()
  .then(({ port }) => {
    console.log(`🧭 UI API running at http://localhost:${port}`);
  })
  .catch(err => {
    console.error('❌ Failed to start UI API:', err);
  });

// In-memory match state: these maps use synthetic IDs and store
// ephemeral display names only (not Telegram user IDs or DB entities).
const members = new Map();
// 2-team split state (from /chiateam)
const teamA = new Map();
const teamB = new Map();
// 3-team split state (from /chiateam 3) — independent of 2-team
const team3A = new Map();
const team3B = new Map();
const team3C = new Map();
let tiensan = null;

startCommand();
unknownCommand();

addMeCommand({ members });
chiateamCommand({ members, teamA, teamB, team3A, team3B, team3C });
benchCommand({ members });
clearBenchCommand({ members });
addCommand({ members });
teamCommand({ teamA, teamB, team3A, team3B, team3C });
tiensanCommand(
  () => tiensan,
  val => {
    tiensan = val;
  }
);
chiaTienCommand(() => tiensan, { teamA, teamB });
taoVoteCommand();
sanCommand();
leaderboardCommand();
updateLeaderboardCommand();
editStatsCommand();
playerCommand();
registerCommand();
playersCommand();
addToTeamCommand({ members, teamA, teamB, team3C });
clearTeamCommand({ teamA, teamB, team3A, team3B, team3C });
meCommand();
matchCommand({ getTiensan: () => tiensan, teamA, teamB, team3C });
matchesCommand();

console.log('🤖 Bot is running...');
