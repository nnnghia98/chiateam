const { COMMAND_MANIFEST } = require('../core/commands/command-manifest');
const {
  createAnnouncementCommand,
} = require('../core/use-cases/common/announcement-command');
const {
  createStartCommand,
} = require('../core/use-cases/common/start-command');
const { createBenchCommand } = require('../core/use-cases/bench/bench-command');
const {
  createDemvoteCommand,
} = require('../core/use-cases/management/demvote-command');
const {
  createPollCommand,
} = require('../core/use-cases/management/poll-command');
const {
  createVoteCommand,
} = require('../core/use-cases/management/vote-command');
const { createTeamCommand } = require('../core/use-cases/teams/team-command');

const ZALO_COMMAND_NAMES = Object.freeze([
  'start',
  'zalosay',
  'poll',
  'vote',
  'demvote',
  'bench',
  'team',
]);

function requireSharedManifestEntry(name) {
  const entry = COMMAND_MANIFEST.find(candidate => candidate.name === name);

  if (!entry) {
    throw new Error(`Missing shared command manifest entry: ${name}`);
  }

  return entry;
}

const ZALO_COMMAND_MANIFEST = Object.freeze(
  [
    requireSharedManifestEntry('start'),
    requireSharedManifestEntry('zalosay'),
    {
      name: 'poll',
      aliases: [],
      category: 'Vote',
      usage: '/poll',
      description: 'Xem vote đang mở',
      permission: 'player',
    },
    {
      name: 'vote',
      aliases: [],
      category: 'Vote',
      usage: '/vote 0|1|2|3|4',
      description: 'Bình chọn hoặc đổi lựa chọn',
      permission: 'player',
    },
    requireSharedManifestEntry('demvote'),
    requireSharedManifestEntry('bench'),
    requireSharedManifestEntry('team'),
  ].map(entry =>
    Object.freeze({
      ...entry,
      aliases: Object.freeze([...(entry.aliases || [])]),
    })
  )
);

function createZaloCommandDefinitions() {
  return Object.freeze([
    createStartCommand({
      manifest: ZALO_COMMAND_MANIFEST,
      includeQuickStart: false,
    }),
    createAnnouncementCommand(),
    createPollCommand(),
    createVoteCommand(),
    createDemvoteCommand(),
    createBenchCommand(),
    createTeamCommand(),
  ]);
}

module.exports = {
  ZALO_COMMAND_MANIFEST,
  ZALO_COMMAND_NAMES,
  createZaloCommandDefinitions,
};
