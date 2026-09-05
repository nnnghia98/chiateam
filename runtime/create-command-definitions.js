const {
  createStartCommand,
} = require('../core/use-cases/common/start-command');
const {
  createAnnouncementCommand,
} = require('../core/use-cases/common/announcement-command');
const {
  assertAnnouncementPublisher,
} = require('../core/ports/announcement-publisher');
const { createAddCommand } = require('../core/use-cases/bench/add-command');
const { createAddmeCommand } = require('../core/use-cases/bench/addme-command');
const { createBenchCommand } = require('../core/use-cases/bench/bench-command');
const {
  createClearbenchCommand,
} = require('../core/use-cases/bench/clearbench-command');
const {
  createEditbenchCommand,
} = require('../core/use-cases/bench/editbench-command');
const {
  createChiateamCommand,
} = require('../core/use-cases/teams/chiateam-command');
const {
  createAddtoteamCommand,
} = require('../core/use-cases/teams/addtoteam-command');
const {
  createClearteamCommand,
} = require('../core/use-cases/teams/clearteam-command');
const {
  createManifestCommand,
} = require('../core/use-cases/teams/manifest-command');
const { createTeamCommand } = require('../core/use-cases/teams/team-command');
const {
  createManifestsCommand,
} = require('../core/use-cases/teams/manifests-command');
const {
  createRemovemanifestCommand,
} = require('../core/use-cases/teams/removemanifest-command');
const {
  createClearmanifestsCommand,
} = require('../core/use-cases/teams/clearmanifests-command');
const {
  createChiatienCommand,
} = require('../core/use-cases/management/chiatien-command');
const {
  createSanCommand,
} = require('../core/use-cases/management/san-command');
const {
  createClearsanCommand,
} = require('../core/use-cases/management/clearsan-command');
const {
  createTiensanCommand,
} = require('../core/use-cases/management/tiensan-command');
const {
  createTiennuocCommand,
} = require('../core/use-cases/management/tiennuoc-command');
const {
  createWinnerCommand,
} = require('../core/use-cases/management/winner-command');
const {
  createLoserCommand,
} = require('../core/use-cases/management/loser-command');
const {
  createTaovoteCommand,
} = require('../core/use-cases/management/taovote-command');
const {
  createDemvoteCommand,
} = require('../core/use-cases/management/demvote-command');
const {
  createSyncCommand,
} = require('../core/use-cases/management/sync-command');
const {
  createClearvoteCommand,
} = require('../core/use-cases/management/clearvote-command');
const {
  createResetCommand,
} = require('../core/use-cases/management/reset-command');
const {
  createRegisterCommand,
} = require('../core/use-cases/players/register-command');
const { createMeCommand } = require('../core/use-cases/players/me-command');
const {
  createPlayersCommand,
} = require('../core/use-cases/players/players-command');
const {
  createPlayerCommand,
} = require('../core/use-cases/players/player-command');
const {
  createEditStatsCommand,
} = require('../core/use-cases/players/edit-stats-command');
const {
  createMatchCommand,
} = require('../core/use-cases/matches/match-command');
const {
  createMatchesCommand,
} = require('../core/use-cases/matches/matches-command');

function createCommandDefinitions({
  announcementPublisher,
  benchIdentityPolicy,
  votePublisher,
  voteController,
  playerRepository,
  statisticsRepository,
  matchRepository,
  matchSummaryGenerator,
} = {}) {
  const activeAnnouncementPublisher = assertAnnouncementPublisher(
    announcementPublisher
  );

  return Object.freeze([
    createStartCommand(),
    createAnnouncementCommand({ publisher: activeAnnouncementPublisher }),
    createAddmeCommand({ identityPolicy: benchIdentityPolicy }),
    createAddCommand(),
    createBenchCommand(),
    createEditbenchCommand(),
    createClearbenchCommand(),
    createChiateamCommand(),
    createTeamCommand(),
    createAddtoteamCommand(),
    createClearteamCommand(),
    createManifestCommand(),
    createManifestsCommand(),
    createRemovemanifestCommand(),
    createClearmanifestsCommand(),
    createSanCommand(),
    createClearsanCommand(),
    createTiensanCommand(),
    createTiennuocCommand(),
    createWinnerCommand(),
    createLoserCommand(),
    createChiatienCommand(),
    createTaovoteCommand({ votePublisher }),
    createDemvoteCommand(),
    createSyncCommand(),
    createClearvoteCommand({ voteController }),
    createRegisterCommand({ playerRepository }),
    createMeCommand({ playerRepository, statisticsRepository }),
    createPlayersCommand({ playerRepository, statisticsRepository }),
    createPlayerCommand({ playerRepository, statisticsRepository }),
    createEditStatsCommand({ statisticsRepository }),
    createMatchCommand({
      matchRepository,
      playerRepository,
      statisticsRepository,
      summaryGenerator: matchSummaryGenerator,
    }),
    createMatchesCommand({ matchRepository }),
    createResetCommand({ voteController }),
  ]);
}

module.exports = {
  createCommandDefinitions,
};
