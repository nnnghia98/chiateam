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
const {
  formatVietnamDate,
  getPerformance,
  normalizeStatistics,
  parsePositiveInteger,
} = require('./player-statistics');

const PLAYER_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /player NUMBER với số áo nguyên dương.',
  noStats: '📭 Chưa có thống kê cho cầu thủ số áo {number}.',
  error: '❌ Có lỗi khi tải thống kê cầu thủ. Vui lòng thử lại.',
});

function buildPlayerSegments(number, player, stats) {
  const ratio =
    stats.losses > 0
      ? (stats.wins / stats.losses).toFixed(2)
      : stats.wins > 0
        ? '∞'
        : '0.00';
  const performance = getPerformance(stats);
  const segments = [
    { text: '🏆 THÔNG SỐ CẦU THỦ 🏆', bold: true },
    { text: `\n\nCầu thủ: ${player?.name || 'Chưa liên kết'}` },
    { text: `\nSố áo: ${number}` },
    { text: `\nNgày tạo: ${formatVietnamDate(stats.createdAt)}` },
    { text: `\nCập nhật: ${formatVietnamDate(stats.updatedAt)}` },
    { text: '\n\n📊 THỐNG KÊ CHI TIẾT:', bold: true },
    { text: `\n• Tổng trận: ${stats.matches}` },
    { text: `\n• Thắng: ${stats.wins}` },
    { text: `\n• Thua: ${stats.losses}` },
    { text: `\n• Hòa: ${stats.draws}` },
    { text: `\n• Bàn thắng: ${stats.goals}` },
    { text: `\n• Kiến tạo: ${stats.assists}` },
    { text: `\n• Tỷ lệ thắng: ${(stats.winrate * 100).toFixed(1)}%` },
    { text: `\n• Tỷ lệ W/L: ${ratio}` },
  ];

  if (performance) {
    segments.push(
      { text: '\n\n📈 ĐÁNH GIÁ:', bold: true },
      { text: `\n${performance}` }
    );
  }

  return segments;
}

function createPlayerCommand({ playerRepository, statisticsRepository } = {}) {
  const players = assertPlayerRepository(playerRepository);
  const statistics = assertStatisticsRepository(statisticsRepository);

  return createCommandDefinition({
    name: 'player',
    aliases: [],
    instruction: {
      usage: '/player NUMBER',
      description: 'Show detailed statistics by shirt number',
      permission: 'player',
    },
    stateKeys: [],
    condition: async context => {
      const number =
        context.args.length === 1
          ? parsePositiveInteger(context.args[0])
          : null;

      return number == null
        ? { ok: false, code: 'INVALID_NUMBER' }
        : { ok: true, number };
    },
    action: async (context, state, condition) => {
      try {
        const [player, statsRow] = await Promise.all([
          players.findByNumber(condition.number),
          statistics.findByNumber(condition.number),
        ]);
        const stats = normalizeStatistics(statsRow);

        return stats
          ? {
              changed: false,
              code: 'PLAYER_STATS',
              number: condition.number,
              player,
              stats,
            }
          : {
              changed: false,
              code: 'PLAYER_STATS_MISSING',
              number: condition.number,
            };
      } catch (error) {
        return { changed: false, code: 'PLAYER_STATS_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_NUMBER') {
        return createTextResult(PLAYER_MESSAGES.usage);
      }

      if (outcome.code === 'PLAYER_STATS_MISSING') {
        return createTextResult(
          PLAYER_MESSAGES.noStats.replace('{number}', outcome.number)
        );
      }

      if (outcome.code === 'PLAYER_STATS_FAILED') {
        return createTextResult(PLAYER_MESSAGES.error);
      }

      return createRichTextResult(
        buildPlayerSegments(outcome.number, outcome.player, outcome.stats),
        [],
        { channel: 'statistics' }
      );
    },
  });
}

module.exports = {
  PLAYER_MESSAGES,
  buildPlayerSegments,
  createPlayerCommand,
};
