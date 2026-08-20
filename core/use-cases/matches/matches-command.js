const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { assertMatchRepository } = require('../../ports/match-repository');
const { parsePositiveInteger } = require('../players/player-statistics');
const { formatDisplayDate } = require('./match-date');

const DEFAULT_MATCH_LIMIT = 10;
const MAX_MATCH_LIMIT = 20;

const MATCHES_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /matches [LIMIT] [PAGE], LIMIT từ 1 đến 20.',
  empty: '📭 Chưa có trận đấu nào ở trang này.',
  error: '❌ Có lỗi khi tải danh sách trận đấu. Vui lòng thử lại.',
});

function parseMatchesRequest(args) {
  if (!Array.isArray(args) || args.length > 2) {
    return null;
  }

  const limit =
    args.length >= 1 ? parsePositiveInteger(args[0]) : DEFAULT_MATCH_LIMIT;
  const page = args.length === 2 ? parsePositiveInteger(args[1]) : 1;

  if (limit == null || limit > MAX_MATCH_LIMIT || page == null) {
    return null;
  }

  return { limit, page, offset: (page - 1) * limit };
}

function buildMatchesSegments(matches, page) {
  const segments = [
    { text: '📅 DANH SÁCH TRẬN ĐẤU 📅', bold: true },
    { text: `\nTrang ${page}\n\n` },
  ];

  matches.forEach(match => {
    const score =
      match.home_score != null && match.away_score != null
        ? ` ${match.home_score} - ${match.away_score}`
        : '';
    segments.push({
      text: `• ${formatDisplayDate(match.match_date)}${score}\n`,
    });
  });

  segments.push({ text: '\nDùng /match view dd/mm/yyyy để xem chi tiết.' });

  return segments;
}

function createMatchesCommand({ matchRepository } = {}) {
  const matches = assertMatchRepository(matchRepository);

  return createCommandDefinition({
    name: 'matches',
    aliases: [],
    instruction: {
      usage: '/matches [LIMIT] [PAGE]',
      description: 'List recent matches with bounded pagination',
      permission: 'player',
    },
    stateKeys: [],
    condition: async context => {
      const request = parseMatchesRequest(context.args);

      return request
        ? { ok: true, request }
        : { ok: false, code: 'INVALID_ARGUMENTS' };
    },
    action: async (context, state, condition) => {
      try {
        const rows = await matches.list(
          condition.request.limit,
          condition.request.offset
        );

        if (!Array.isArray(rows)) {
          return { changed: false, code: 'MATCHES_LOAD_FAILED' };
        }

        return rows.length === 0
          ? { changed: false, code: 'MATCHES_EMPTY' }
          : {
              changed: false,
              code: 'MATCHES_LIST',
              matches: rows,
              page: condition.request.page,
            };
      } catch (error) {
        return { changed: false, code: 'MATCHES_LOAD_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createTextResult(MATCHES_MESSAGES.usage);
      }

      if (outcome.code === 'MATCHES_EMPTY') {
        return createTextResult(MATCHES_MESSAGES.empty);
      }

      if (outcome.code === 'MATCHES_LOAD_FAILED') {
        return createTextResult(MATCHES_MESSAGES.error);
      }

      return createRichTextResult(
        buildMatchesSegments(outcome.matches, outcome.page)
      );
    },
  });
}

module.exports = {
  DEFAULT_MATCH_LIMIT,
  MATCHES_MESSAGES,
  MAX_MATCH_LIMIT,
  buildMatchesSegments,
  createMatchesCommand,
  parseMatchesRequest,
};
