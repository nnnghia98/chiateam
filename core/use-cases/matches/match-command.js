const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { assertMatchRepository } = require('../../ports/match-repository');
const {
  assertMatchSummaryGenerator,
} = require('../../ports/match-summary-generator');
const { assertPlayerRepository } = require('../../ports/player-repository');
const {
  assertStatisticsRepository,
} = require('../../ports/statistics-repository');
const { parsePositiveInteger } = require('../players/player-statistics');
const {
  formatDisplayDate,
  getThursdayDate,
  parseDisplayDate,
} = require('./match-date');
const { buildMatchLineups } = require('./match-lineup');

const MATCH_SAVE_STATE_KEYS = Object.freeze([
  'san',
  'tiensan',
  'teamA',
  'teamB',
  'team3C',
]);
const MATCH_WRITE_ACTIONS = new Set([
  'save',
  'score',
  'goal',
  'assist',
  'mvp',
  'delete',
]);

const MATCH_MESSAGES = Object.freeze({
  usage:
    '📋 Cách dùng /match:\n' +
    '• /match view [dd/mm/yyyy]\n' +
    '• /match save [dd/mm/yyyy] (admin)\n' +
    '• /match score HOME-AWAY [dd/mm/yyyy] (admin)\n' +
    '• /match goal NUMBER COUNT [dd/mm/yyyy] (admin)\n' +
    '• /match assist NUMBER COUNT [dd/mm/yyyy] (admin)\n' +
    '• /match mvp NUMBER [dd/mm/yyyy] (admin)\n' +
    '• /match delete dd/mm/yyyy (admin)',
  permissionDenied: '⛔ Chỉ admin mới có quyền thay đổi trận đấu.',
  invalidDate: '⚠️ Ngày không hợp lệ. Dùng định dạng dd/mm/yyyy.',
  invalidScore: '⚠️ Tỷ số không hợp lệ. Ví dụ: 3-1.',
  invalidPlayer: '⚠️ Số áo không hợp lệ hoặc chưa đăng ký.',
  invalidCount: '⚠️ Số bàn hoặc kiến tạo phải là số nguyên dương.',
  noMatch: '📭 Chưa có trận đấu cho ngày này.',
  noDataToSave:
    '⚠️ Cần có team và ít nhất sân hoặc tiền sân trước khi lưu trận.',
  playerNotInMatch: '⚠️ Cầu thủ số {number} không có trong trận đấu này.',
  saved: '✅ Đã lưu trận đấu!',
  scoreUpdated: '✅ Đã cập nhật tỷ số!',
  goalUpdated: '✅ Đã cập nhật bàn thắng!',
  assistUpdated: '✅ Đã cập nhật kiến tạo!',
  mvpUpdated: '✅ Đã cập nhật MVP!',
  statPartial:
    '⚠️ Đã cập nhật trận đấu nhưng chưa cập nhật được bảng thống kê.',
  deleteSuccess: '✅ Đã xóa trận đấu.',
  deleteMissing: '📭 Không có trận đấu cho ngày này để xóa.',
  loadStateError: '❌ Không thể tải dữ liệu trận kế tiếp từ API.',
  error: '❌ Có lỗi khi xử lý trận đấu. Vui lòng thử lại.',
});

function parseScore(value) {
  const match = String(value ?? '').match(/^(\d+)-(\d+)$/);

  if (!match) {
    return null;
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  return Number.isSafeInteger(home) && Number.isSafeInteger(away)
    ? { home, away }
    : null;
}

function resolveRequestDate(value, now) {
  if (value == null) {
    return { date: getThursdayDate(now()) };
  }

  const date = parseDisplayDate(value);

  return date ? { date } : { error: 'INVALID_DATE' };
}

function parseMatchRequest(args, now = () => new Date()) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'help' };
  }

  const action = String(args[0]).trim().toLowerCase();

  if (action === 'view' || action === 'save') {
    if (args.length > 2) return { error: 'INVALID_ARGUMENTS' };
    const resolved = resolveRequestDate(args[1], now);
    return resolved.error ? resolved : { kind: action, date: resolved.date };
  }

  if (action === 'score') {
    if (args.length < 2 || args.length > 3) {
      return { error: 'INVALID_ARGUMENTS' };
    }
    const score = parseScore(args[1]);
    if (!score) return { error: 'INVALID_SCORE' };
    const resolved = resolveRequestDate(args[2], now);
    return resolved.error
      ? resolved
      : { kind: 'score', date: resolved.date, score };
  }

  if (action === 'goal' || action === 'assist') {
    if (args.length < 3 || args.length > 4) {
      return { error: 'INVALID_ARGUMENTS' };
    }
    const number = parsePositiveInteger(args[1]);
    const count = parsePositiveInteger(args[2]);
    if (number == null) return { error: 'INVALID_PLAYER' };
    if (count == null) return { error: 'INVALID_COUNT' };
    const resolved = resolveRequestDate(args[3], now);
    return resolved.error
      ? resolved
      : { kind: action, date: resolved.date, number, count };
  }

  if (action === 'mvp') {
    if (args.length < 2 || args.length > 3) {
      return { error: 'INVALID_ARGUMENTS' };
    }
    const number = parsePositiveInteger(args[1]);
    if (number == null) return { error: 'INVALID_PLAYER' };
    const resolved = resolveRequestDate(args[2], now);
    return resolved.error
      ? resolved
      : { kind: 'mvp', date: resolved.date, number };
  }

  if (action === 'delete') {
    if (args.length !== 2) return { error: 'INVALID_ARGUMENTS' };
    const date = parseDisplayDate(args[1]);
    return date ? { kind: 'delete', date } : { error: 'INVALID_DATE' };
  }

  return { error: 'INVALID_ARGUMENTS' };
}

function normalizeSaveState(state) {
  const teamsValid = ['teamA', 'teamB', 'team3C'].every(key =>
    Array.isArray(state[key])
  );
  const san =
    typeof state.san === 'string'
      ? state.san.trim() || null
      : (state.san ?? null);
  const tiensan = Number(state.tiensan ?? 0);

  if (
    !teamsValid ||
    (san != null && typeof san !== 'string') ||
    !Number.isSafeInteger(tiensan) ||
    tiensan < 0
  ) {
    return null;
  }

  return {
    san,
    tiensan,
    teamA: state.teamA,
    teamB: state.teamB,
    team3C: state.team3C,
  };
}

function hasSaveData(state) {
  const hasTeams =
    state.teamA.length + state.teamB.length + state.team3C.length;
  return hasTeams > 0 && Boolean(state.san || state.tiensan > 0);
}

async function getOptionalSummary(generator, match) {
  if (match?.home_score == null || match?.away_score == null) {
    return null;
  }

  try {
    return await generator.generate(match);
  } catch (error) {
    return null;
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

function buildMatchSegments(match, date, summary = null, prefix = null) {
  const segments = [];

  if (prefix) {
    segments.push({ text: prefix, bold: true }, { text: '\n\n' });
  }

  segments.push({
    text: `⚽ Trận đấu ${formatDisplayDate(date)} ⚽`,
    bold: true,
  });

  if (match.san) segments.push({ text: `\n\n📍 Sân: ${match.san}` });
  if (match.tiensan) {
    segments.push({ text: `\n💸 Tiền sân: ${formatMoney(match.tiensan)} VND` });
  }
  if (match.home_score != null && match.away_score != null) {
    segments.push({
      text: `\n\n📊 Kết quả: ${match.home_score} - ${match.away_score}`,
    });
  }

  const addTeam = (label, players) => {
    segments.push({ text: `\n\n${label}:`, bold: true });

    if (!Array.isArray(players) || players.length === 0) {
      segments.push({ text: '\n• (trống)' });
      return;
    }

    players.forEach(player => {
      const details = [];
      if (player.isMvp) details.push('⭐');
      if (player.goals) details.push(`${player.goals}⚽`);
      if (player.assists) details.push(`${player.assists}🎯`);
      segments.push({
        text: `\n• ${player.label || player.displayName || player.name || '?'}${
          details.length > 0 ? ` (${details.join(' ')})` : ''
        }`,
      });
    });
  };

  addTeam('⚪ HOME', match.homePlayers);
  addTeam('⚫ AWAY', match.awayPlayers);
  if (Array.isArray(match.extraPlayers) && match.extraPlayers.length > 0) {
    addTeam('🟠 EXTRA', match.extraPlayers);
  }

  if (summary) {
    segments.push(
      { text: '\n\n🤖 Bình luận AI:', bold: true },
      { text: `\n${summary}` }
    );
  }

  return segments;
}

function createMatchCommand({
  matchRepository,
  playerRepository,
  statisticsRepository,
  summaryGenerator,
  now = () => new Date(),
} = {}) {
  const matches = assertMatchRepository(matchRepository);
  const players = assertPlayerRepository(playerRepository);
  const statistics = assertStatisticsRepository(statisticsRepository);
  const summaries = assertMatchSummaryGenerator(summaryGenerator);

  if (typeof now !== 'function') {
    throw new TypeError('Match clock must be a function.');
  }

  return createCommandDefinition({
    name: 'match',
    aliases: [],
    instruction: {
      usage: '/match ACTION [ARGS]',
      description: 'View or manage one match with explicit actions',
      permission: 'player',
    },
    resolvePermission: context =>
      MATCH_WRITE_ACTIONS.has(String(context.args[0] ?? '').toLowerCase())
        ? 'admin'
        : 'player',
    stateKeys: [],
    resolveStateKeys: context =>
      String(context.args[0] ?? '').toLowerCase() === 'save'
        ? MATCH_SAVE_STATE_KEYS
        : [],
    condition: async (context, state) => {
      const request = parseMatchRequest(context.args, now);

      if (request.error) {
        return { ok: false, code: request.error };
      }

      if (request.kind === 'save') {
        const saveState = normalizeSaveState(state);

        if (!saveState) {
          return { ok: false, code: 'INVALID_SAVE_STATE' };
        }

        if (!hasSaveData(saveState)) {
          return { ok: false, code: 'NO_DATA_TO_SAVE' };
        }

        return { ok: true, request, saveState };
      }

      return { ok: true, request };
    },
    action: async (context, state, condition) => {
      const { request } = condition;

      if (request.kind === 'help') {
        return { changed: false, code: 'MATCH_HELP' };
      }

      try {
        if (request.kind === 'view') {
          const match = await matches.findWithPlayers(request.date);

          if (!match) {
            return { changed: false, code: 'MATCH_MISSING' };
          }

          return {
            changed: false,
            code: 'MATCH_VIEW',
            match,
            date: request.date,
            summary: await getOptionalSummary(summaries, match),
          };
        }

        if (request.kind === 'save') {
          const lineups = await buildMatchLineups(condition.saveState, players);

          if (!lineups) {
            return { changed: false, code: 'MATCH_ACTION_FAILED' };
          }

          const match = await matches.save({
            matchDate: request.date,
            san: condition.saveState.san,
            tiensan: condition.saveState.tiensan || null,
            ...lineups,
          });

          return {
            changed: false,
            code: 'MATCH_SAVED',
            match,
            date: request.date,
          };
        }

        if (request.kind === 'score') {
          if (!(await matches.findByDate(request.date))) {
            return { changed: false, code: 'MATCH_MISSING' };
          }

          const match = await matches.updateScore(
            request.date,
            request.score.home,
            request.score.away
          );

          return {
            changed: false,
            code: 'MATCH_SCORE_UPDATED',
            match,
            date: request.date,
            summary: await getOptionalSummary(summaries, match),
          };
        }

        if (request.kind === 'delete') {
          const deleted = await matches.deleteByDate(request.date);

          return {
            changed: false,
            code: deleted ? 'MATCH_DELETED' : 'MATCH_DELETE_MISSING',
          };
        }

        const player = await players.findByNumber(request.number);

        if (!player?.id) {
          return { changed: false, code: 'INVALID_PLAYER' };
        }

        const match = await matches.findByDate(request.date);

        if (!match) {
          return { changed: false, code: 'MATCH_MISSING' };
        }

        if (!(await matches.containsPlayer(match.id, player.id))) {
          return {
            changed: false,
            code: 'PLAYER_NOT_IN_MATCH',
            number: request.number,
          };
        }

        if (request.kind === 'mvp') {
          await matches.setMvp(match.id, player.id);
          return { changed: false, code: 'MATCH_MVP_UPDATED' };
        }

        const stat = request.kind === 'goal' ? 'goals' : 'assists';
        await matches.addPlayerStat(match.id, player.id, stat, request.count);
        const aggregateResult =
          request.kind === 'goal'
            ? await statistics.incrementGoals(request.number, request.count)
            : await statistics.incrementAssists(request.number, request.count);

        return {
          changed: false,
          code:
            aggregateResult?.ok === false
              ? 'MATCH_STAT_PARTIAL'
              : request.kind === 'goal'
                ? 'MATCH_GOAL_UPDATED'
                : 'MATCH_ASSIST_UPDATED',
        };
      } catch (error) {
        return { changed: false, code: 'MATCH_ACTION_FAILED', error };
      }
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(MATCH_MESSAGES.permissionDenied);
      }

      if (
        outcome.code === 'MATCH_HELP' ||
        outcome.code === 'INVALID_ARGUMENTS'
      ) {
        return createTextResult(MATCH_MESSAGES.usage);
      }

      if (outcome.code === 'INVALID_DATE') {
        return createTextResult(MATCH_MESSAGES.invalidDate);
      }

      if (outcome.code === 'INVALID_SCORE') {
        return createTextResult(MATCH_MESSAGES.invalidScore);
      }

      if (outcome.code === 'INVALID_PLAYER') {
        return createTextResult(MATCH_MESSAGES.invalidPlayer);
      }

      if (outcome.code === 'INVALID_COUNT') {
        return createTextResult(MATCH_MESSAGES.invalidCount);
      }

      if (outcome.code === 'MATCH_MISSING') {
        return createTextResult(MATCH_MESSAGES.noMatch);
      }

      if (outcome.code === 'NO_DATA_TO_SAVE') {
        return createTextResult(MATCH_MESSAGES.noDataToSave);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_SAVE_STATE'
      ) {
        return createTextResult(MATCH_MESSAGES.loadStateError);
      }

      if (outcome.code === 'PLAYER_NOT_IN_MATCH') {
        return createTextResult(
          MATCH_MESSAGES.playerNotInMatch.replace('{number}', outcome.number)
        );
      }

      if (outcome.code === 'MATCH_GOAL_UPDATED') {
        return createTextResult(MATCH_MESSAGES.goalUpdated);
      }

      if (outcome.code === 'MATCH_ASSIST_UPDATED') {
        return createTextResult(MATCH_MESSAGES.assistUpdated);
      }

      if (outcome.code === 'MATCH_MVP_UPDATED') {
        return createTextResult(MATCH_MESSAGES.mvpUpdated);
      }

      if (outcome.code === 'MATCH_STAT_PARTIAL') {
        return createTextResult(MATCH_MESSAGES.statPartial);
      }

      if (outcome.code === 'MATCH_DELETED') {
        return createTextResult(MATCH_MESSAGES.deleteSuccess);
      }

      if (outcome.code === 'MATCH_DELETE_MISSING') {
        return createTextResult(MATCH_MESSAGES.deleteMissing);
      }

      if (outcome.code === 'MATCH_ACTION_FAILED') {
        return createTextResult(MATCH_MESSAGES.error);
      }

      if (outcome.code === 'MATCH_SAVED') {
        return createRichTextResult(
          buildMatchSegments(
            outcome.match,
            outcome.date,
            null,
            MATCH_MESSAGES.saved
          ),
          [],
          { channel: 'announcement' }
        );
      }

      if (outcome.code === 'MATCH_SCORE_UPDATED') {
        return createRichTextResult(
          buildMatchSegments(
            outcome.match,
            outcome.date,
            outcome.summary,
            MATCH_MESSAGES.scoreUpdated
          )
        );
      }

      return createRichTextResult(
        buildMatchSegments(outcome.match, outcome.date, outcome.summary)
      );
    },
  });
}

module.exports = {
  MATCH_MESSAGES,
  MATCH_SAVE_STATE_KEYS,
  MATCH_WRITE_ACTIONS,
  buildMatchSegments,
  createMatchCommand,
  hasSaveData,
  normalizeSaveState,
  parseMatchRequest,
  parseScore,
};
