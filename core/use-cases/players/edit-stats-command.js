const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const {
  assertStatisticsRepository,
} = require('../../ports/statistics-repository');
const {
  normalizeStatistics,
  parseNonNegativeInteger,
  parsePositiveInteger,
} = require('./player-statistics');

const EDIT_STATS_FIELDS = Object.freeze(['matches', 'wins', 'losses', 'draws']);

const EDIT_STATS_MESSAGES = Object.freeze({
  usage:
    '⚠️ Dùng /edit-stats NUMBER matches=N wins=N losses=N draws=N.\n' +
    'Ví dụ: /edit-stats 10 matches=8 wins=5 losses=2 draws=1',
  permissionDenied: '⛔ Chỉ admin mới có quyền chỉnh thống kê.',
  invalidTotals: '⚠️ matches phải bằng wins + losses + draws.',
  error: '❌ Có lỗi khi lưu thống kê. Vui lòng thử lại.',
});

function parseEditStatsRequest(args) {
  if (!Array.isArray(args) || args.length !== 5) {
    return null;
  }

  const number = parsePositiveInteger(args[0]);
  const values = {};

  if (number == null) {
    return null;
  }

  for (const token of args.slice(1)) {
    const match = String(token).match(/^([a-z]+)=(\d+)$/i);

    if (!match) {
      return null;
    }

    const field = match[1].toLowerCase();
    const value = parseNonNegativeInteger(match[2]);

    if (
      !EDIT_STATS_FIELDS.includes(field) ||
      Object.prototype.hasOwnProperty.call(values, field) ||
      value == null
    ) {
      return null;
    }

    values[field] = value;
  }

  if (EDIT_STATS_FIELDS.some(field => values[field] == null)) {
    return null;
  }

  return { number, totals: values };
}

function buildEditStatsSegments(number, before, after) {
  const segments = [
    { text: '✏️ ĐÃ CẬP NHẬT THỐNG KÊ', bold: true },
    { text: `\n\nSố áo: ${number}` },
  ];

  if (before) {
    segments.push(
      { text: '\n\nThống kê cũ:', bold: true },
      {
        text:
          `\nTrận: ${before.matches} | Thắng: ${before.wins} | ` +
          `Thua: ${before.losses} | Hòa: ${before.draws}`,
      }
    );
  }

  segments.push(
    { text: '\n\nThống kê mới:', bold: true },
    {
      text:
        `\nTrận: ${after.matches} | Thắng: ${after.wins} | ` +
        `Thua: ${after.losses} | Hòa: ${after.draws}`,
    },
    {
      text: `\nWinrate: ${(
        (after.matches > 0 ? after.wins / after.matches : 0) * 100
      ).toFixed(1)}%`,
    }
  );

  return segments;
}

function createEditStatsCommand({ statisticsRepository } = {}) {
  const statistics = assertStatisticsRepository(statisticsRepository);

  return createCommandDefinition({
    name: 'edit-stats',
    aliases: [],
    instruction: {
      usage: '/edit-stats NUMBER matches=N wins=N losses=N draws=N',
      description: 'Replace player totals with explicit named fields',
      permission: 'admin',
    },
    stateKeys: [],
    condition: async context => {
      const request = parseEditStatsRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      const { totals } = request;

      if (totals.matches !== totals.wins + totals.losses + totals.draws) {
        return { ok: false, code: 'INVALID_TOTALS' };
      }

      return { ok: true, request };
    },
    action: async (context, state, condition) => {
      try {
        const before = normalizeStatistics(
          await statistics.findByNumber(condition.request.number)
        );
        await statistics.replaceTotals(
          condition.request.number,
          condition.request.totals
        );

        return {
          changed: false,
          code: 'STATS_REPLACED',
          number: condition.request.number,
          before,
          after: condition.request.totals,
        };
      } catch (error) {
        return { changed: false, code: 'STATS_REPLACE_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(EDIT_STATS_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_REQUEST') {
        return createTextResult(EDIT_STATS_MESSAGES.usage);
      }

      if (outcome.code === 'INVALID_TOTALS') {
        return createTextResult(EDIT_STATS_MESSAGES.invalidTotals);
      }

      if (outcome.code === 'STATS_REPLACE_FAILED') {
        return createTextResult(EDIT_STATS_MESSAGES.error);
      }

      return createRichTextResult(
        buildEditStatsSegments(outcome.number, outcome.before, outcome.after),
        [],
        { channel: 'statistics' }
      );
    },
  });
}

module.exports = {
  EDIT_STATS_FIELDS,
  EDIT_STATS_MESSAGES,
  buildEditStatsSegments,
  createEditStatsCommand,
  parseEditStatsRequest,
};
