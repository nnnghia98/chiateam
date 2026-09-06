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
const {
  createZaloSubscriptionCommand,
} = require('../core/use-cases/common/zalo-subscription-command');
const {
  createApiZaloAnnouncementRepository,
} = require('./repositories/api-zalo-announcement-repository');

const ZALO_COMMAND_NAMES = Object.freeze([
  'start',
  'zalosay',
  'subscribe',
  'unsubscribe',
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
    {
      ...requireSharedManifestEntry('zalosay'),
      description: 'Gửi nội dung vào chat hiện tại, không gửi đến mọi người',
    },
    {
      name: 'subscribe',
      aliases: [],
      category: 'Thông báo',
      usage: '/subscribe',
      description: 'Đăng ký nhận thông báo của đội trong chat riêng',
      permission: 'player',
    },
    {
      name: 'unsubscribe',
      aliases: [],
      category: 'Thông báo',
      usage: '/unsubscribe',
      description: 'Ngừng nhận thông báo của đội',
      permission: 'player',
    },
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

function createZaloCommandDefinitions({
  subscriptionRepository = createApiZaloAnnouncementRepository(),
} = {}) {
  return Object.freeze([
    createStartCommand({
      manifest: ZALO_COMMAND_MANIFEST,
      includeQuickStart: false,
    }),
    createAnnouncementCommand(),
    createZaloSubscriptionCommand({
      repository: subscriptionRepository,
      subscribed: true,
    }),
    createZaloSubscriptionCommand({
      repository: subscriptionRepository,
      subscribed: false,
    }),
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
