const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { assertPlayerRepository } = require('../../ports/player-repository');
const {
  assertStatisticsRepository,
} = require('../../ports/statistics-repository');
const { normalizeStatistics } = require('./player-statistics');

const ME_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /me không kèm tham số.',
  notRegistered: '⚠️ Bạn chưa đăng ký. Dùng /register NUMBER để đăng ký.',
  error: '❌ Có lỗi xảy ra khi tải thông tin cầu thủ.',
});

function buildMeSegments(actor, player, stats) {
  const segments = [
    { text: '👤 Thông tin của bạn:', bold: true },
    { text: `\nTên: ${actor.displayName || 'Không rõ'}` },
    { text: `\nID nền tảng: ${actor.externalId}` },
    {
      text: `\nUsername: ${actor.username ? `@${actor.username}` : 'Chưa có'}`,
    },
  ];

  if (!player) {
    segments.push({ text: `\n\n${ME_MESSAGES.notRegistered}` });
    return segments;
  }

  segments.push(
    { text: '\n\n⚽ Thông tin cầu thủ:', bold: true },
    { text: `\nTên đăng ký: ${player.name}` },
    { text: `\nSố áo: ${player.number}` },
    { text: `\nBàn thắng: ${stats?.goals ?? 0}` },
    { text: `\nKiến tạo: ${stats?.assists ?? 0}` }
  );

  return segments;
}

function createMeCommand({ playerRepository, statisticsRepository } = {}) {
  const players = assertPlayerRepository(playerRepository);
  const statistics = assertStatisticsRepository(statisticsRepository);

  return createCommandDefinition({
    name: 'me',
    aliases: [],
    instruction: {
      usage: '/me',
      description: 'Show the actor and linked player information',
      permission: 'player',
    },
    stateKeys: [],
    condition: async context =>
      context.args.length === 0
        ? { ok: true }
        : { ok: false, code: 'INVALID_ARGUMENTS' },
    action: async context => {
      try {
        const player = await players.findByActor(context.actor);
        const stats = player
          ? normalizeStatistics(
              await statistics.findByNumber(Number(player.number))
            )
          : null;

        return {
          changed: false,
          code: 'PLAYER_INFO',
          actor: context.actor,
          player,
          stats,
        };
      } catch (error) {
        return { changed: false, code: 'PLAYER_INFO_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createTextResult(ME_MESSAGES.usage);
      }

      if (outcome.code === 'PLAYER_INFO_FAILED') {
        return createTextResult(ME_MESSAGES.error);
      }

      return createRichTextResult(
        buildMeSegments(outcome.actor, outcome.player, outcome.stats)
      );
    },
  });
}

module.exports = {
  ME_MESSAGES,
  buildMeSegments,
  createMeCommand,
};
