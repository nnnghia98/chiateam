const {
  createStartCommand,
} = require('../core/use-cases/common/start-command');
const {
  createManagedCommandRules,
} = require('../core/commands/managed-command-rules');
const {
  createAnnouncementCommand,
} = require('../core/use-cases/common/announcement-command');
const {
  createZaloBroadcastCommand,
} = require('../core/use-cases/common/zalo-broadcast-command');
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
  createVoteCommand,
} = require('../core/use-cases/management/vote-command');
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
  createMatchCommand,
} = require('../core/use-cases/matches/match-command');
const {
  createMatchesCommand,
} = require('../core/use-cases/matches/matches-command');

function createCommandDefinitions({
  env = process.env,
  announcementPublisher,
  broadcastService,
  benchIdentityPolicy,
  votePublisher,
  voteController,
  playerRepository,
  matchRepository,
  matchSummaryGenerator,
} = {}) {
  const announcementCommand = broadcastService
    ? createZaloBroadcastCommand({ service: broadcastService })
    : createAnnouncementCommand({
      publisher: assertAnnouncementPublisher(announcementPublisher),
    });

  return Object.freeze([
    createStartCommand({ commandRules: createManagedCommandRules(env) }),
    announcementCommand,
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
    createVoteCommand(),
    createDemvoteCommand(),
    createSyncCommand(),
    createClearvoteCommand({ voteController }),
    createRegisterCommand({ playerRepository }),
    createMeCommand({ playerRepository }),
    createMatchCommand({
      matchRepository,
      playerRepository,
      summaryGenerator: matchSummaryGenerator,
    }),
    createMatchesCommand({ matchRepository }),
    createResetCommand({ voteController }),
  ]);
}

module.exports = {
  createCommandDefinitions,
};
