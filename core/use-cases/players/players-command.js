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
const { parsePositiveInteger, rankPlayers } = require('./player-statistics');

const DEFAULT_PLAYERS_PAGE_SIZE = 10;

const PLAYERS_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /players hoặc /players PAGE.',
  empty: '📭 Chưa có cầu thủ nào đăng ký. Dùng /register NUMBER để đăng ký.',
  invalidPage: '⚠️ Trang cầu thủ không tồn tại.',
  error: '❌ Có lỗi khi tải danh sách cầu thủ. Vui lòng thử lại.',
});

function parsePlayersRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { page: 1 };
  }

  if (args.length !== 1) {
    return null;
  }

  const page = parsePositiveInteger(args[0]);

  return page == null ? null : { page };
}

function buildPlayersSegments({ rows, page, totalPages, startIndex }) {
  const segments = [
    { text: '👥 DANH SÁCH CẦU THỦ 👥', bold: true },
    { text: `\nXếp hạng theo winrate • Trang ${page}/${totalPages}\n\n` },
  ];

  rows.forEach(({ player, stats }, index) => {
    segments.push(
      {
        text: `${startIndex + index + 1}. ${player.name} (#${player.number})`,
        bold: true,
      },
      {
        text:
          `\n   📊 Trận: ${stats.matches} | Thắng: ${stats.wins} | ` +
          `Thua: ${stats.losses} | Hòa: ${stats.draws}`,
      },
      {
        text:
          `\n   ⚽ ${stats.goals} bàn | 🎯 ${stats.assists} KT | ` +
          `Winrate: ${(stats.winrate * 100).toFixed(1)}%\n\n`,
      }
    );
  });

  return segments;
}

function createPlayersCommand({
  playerRepository,
  statisticsRepository,
  pageSize = DEFAULT_PLAYERS_PAGE_SIZE,
} = {}) {
  const players = assertPlayerRepository(playerRepository);
  const statistics = assertStatisticsRepository(statisticsRepository);

  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new TypeError('Players page size must be a positive integer.');
  }

  return createCommandDefinition({
    name: 'players',
    aliases: [],
    instruction: {
      usage: '/players [PAGE]',
      description: 'Show a ranked and paginated player list',
      permission: 'player',
    },
    stateKeys: [],
    condition: async context => {
      const request = parsePlayersRequest(context.args);

      return request
        ? { ok: true, request }
        : { ok: false, code: 'INVALID_ARGUMENTS' };
    },
    action: async (context, state, condition) => {
      try {
        const playerRows = await players.list();

        if (!Array.isArray(playerRows)) {
          return { changed: false, code: 'PLAYERS_LOAD_FAILED' };
        }

        if (playerRows.length === 0) {
          return { changed: false, code: 'PLAYERS_EMPTY' };
        }

        const numbers = playerRows.map(player => Number(player.number));
        const statsRows = await statistics.findMany(numbers);

        if (!Array.isArray(statsRows)) {
          return { changed: false, code: 'PLAYERS_LOAD_FAILED' };
        }

        const ranked = rankPlayers(playerRows, statsRows);
        const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
        const page = condition.request.page;

        if (page > totalPages) {
          return { changed: false, code: 'INVALID_PAGE' };
        }

        const startIndex = (page - 1) * pageSize;

        return {
          changed: false,
          code: 'PLAYERS_LIST',
          rows: ranked.slice(startIndex, startIndex + pageSize),
          page,
          totalPages,
          startIndex,
        };
      } catch (error) {
        return { changed: false, code: 'PLAYERS_LOAD_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createTextResult(PLAYERS_MESSAGES.usage);
      }

      if (outcome.code === 'PLAYERS_EMPTY') {
        return createTextResult(PLAYERS_MESSAGES.empty, [], {
          channel: 'statistics',
        });
      }

      if (outcome.code === 'INVALID_PAGE') {
        return createTextResult(PLAYERS_MESSAGES.invalidPage);
      }

      if (outcome.code === 'PLAYERS_LOAD_FAILED') {
        return createTextResult(PLAYERS_MESSAGES.error);
      }

      return createRichTextResult(buildPlayersSegments(outcome), [], {
        channel: 'statistics',
      });
    },
  });
}

module.exports = {
  DEFAULT_PLAYERS_PAGE_SIZE,
  PLAYERS_MESSAGES,
  buildPlayersSegments,
  createPlayersCommand,
  parsePlayersRequest,
};
