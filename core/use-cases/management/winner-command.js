const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { buildDetailedSplitSegments, normalizeFeeState } = require('./fee-view');
const { calculateTwoTeamFee } = require('./two-team-fee');

const WINNER_STATE_KEYS = Object.freeze([
  'tiensan',
  'tiennuoc',
  'teamThua',
  'teamA',
  'teamB',
  'team3A',
  'team3B',
  'team3C',
]);

const WINNER_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /winner HOME hoặc /winner AWAY.',
  permissionDenied: '⛔ Chỉ admin mới có quyền thay đổi team thắng.',
  noWinner: '⚠️ Chưa chọn team thắng. Dùng /winner HOME hoặc /winner AWAY.',
  current: '📋 Team thắng hiện tại: ',
  success: '✅ Đã chọn team thắng: ',
  threeTeamUnsupported:
    '⚠️ Chưa hỗ trợ tính tiền cho 3 team. Hãy dùng 2 team để dùng lệnh này.',
  loadError: '❌ Không thể tải kết quả team hiện tại từ API.',
  saveError: '❌ Không thể lưu team thắng. Vui lòng thử lại.',
});

function getWinnerFromLoser(loser) {
  return loser === 'HOME' ? 'AWAY' : 'HOME';
}

function getLoserFromWinner(winner) {
  return winner === 'HOME' ? 'AWAY' : 'HOME';
}

function parseWinnerRequest(args) {
  if (!Array.isArray(args)) {
    return null;
  }

  if (args.length === 0) {
    return { kind: 'read' };
  }

  if (args.length !== 1) {
    return null;
  }

  const winner = String(args[0]).trim().toUpperCase();

  if (!['HOME', 'AWAY'].includes(winner)) {
    return null;
  }

  return {
    kind: 'write',
    winner,
    loser: getLoserFromWinner(winner),
  };
}

function normalizeStoredLoser(value) {
  if (value == null || value === '') {
    return { ok: true, loser: null };
  }

  return ['HOME', 'AWAY'].includes(value)
    ? { ok: true, loser: value }
    : { ok: false, loser: null };
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createRichDefaultResult = segments =>
  createRichTextResult(segments, [], { channel: 'default' });
const createRichAnnouncementResult = segments =>
  createRichTextResult(segments, [], { channel: 'announcement' });

function createTeamResultSegments(prefix, team) {
  return [{ text: prefix }, { text: team, bold: true }];
}

function createWinnerCommand() {
  return createCommandDefinition({
    name: 'winner',
    aliases: [],
    instruction: {
      usage: '/winner [HOME|AWAY]',
      description: 'Read or update the winning team',
      permission: 'player',
    },
    resolvePermission: context =>
      context.args.length > 0 ? 'admin' : 'player',
    stateKeys: WINNER_STATE_KEYS,
    condition: async (context, state) => {
      const request = parseWinnerRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      const feeState = normalizeFeeState(state);
      const storedResult = normalizeStoredLoser(state.teamThua);

      if (!feeState || !storedResult.ok) {
        return { ok: false, code: 'INVALID_RESULT_STATE' };
      }

      return {
        ok: true,
        request,
        feeState: { ...feeState, teamThua: storedResult.loser },
      };
    },
    action: async (context, state, condition) => {
      const { request, feeState } = condition;

      if (request.kind === 'read') {
        return feeState.teamThua
          ? {
              changed: false,
              code: 'WINNER_CURRENT',
              winner: getWinnerFromLoser(feeState.teamThua),
            }
          : { changed: false, code: 'WINNER_MISSING' };
      }

      const hasTwoTeamMembers = feeState.teamA.length + feeState.teamB.length;
      const hasThreeTeamMembers =
        feeState.team3A.length +
        feeState.team3B.length +
        feeState.team3C.length;

      if (!hasTwoTeamMembers && hasThreeTeamMembers) {
        return { changed: false, code: 'THREE_TEAM_UNSUPPORTED' };
      }

      let breakdown = null;

      if (feeState.tiensan > 0 && hasTwoTeamMembers) {
        breakdown = calculateTwoTeamFee({
          tiensan: feeState.tiensan,
          tiennuoc: feeState.tiennuoc,
          teamThua: request.loser,
          teamA: feeState.teamA,
          teamB: feeState.teamB,
        });
      }

      return {
        changed: true,
        code: breakdown ? 'WINNER_SAVED_WITH_SPLIT' : 'WINNER_SAVED',
        changes: { teamThua: request.loser },
        winner: request.winner,
        tiensan: feeState.tiensan,
        tiennuoc: feeState.tiennuoc,
        breakdown,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(WINNER_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(WINNER_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_RESULT_STATE'
      ) {
        return createDefaultResult(WINNER_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(WINNER_MESSAGES.saveError);
      }

      if (outcome.code === 'THREE_TEAM_UNSUPPORTED') {
        return createDefaultResult(WINNER_MESSAGES.threeTeamUnsupported);
      }

      if (outcome.code === 'WINNER_MISSING') {
        return createDefaultResult(WINNER_MESSAGES.noWinner);
      }

      if (outcome.code === 'WINNER_CURRENT') {
        return createRichDefaultResult(
          createTeamResultSegments(WINNER_MESSAGES.current, outcome.winner)
        );
      }

      if (outcome.code === 'WINNER_SAVED_WITH_SPLIT') {
        return createRichAnnouncementResult(
          buildDetailedSplitSegments(outcome)
        );
      }

      return createRichDefaultResult(
        createTeamResultSegments(WINNER_MESSAGES.success, outcome.winner)
      );
    },
  });
}

module.exports = {
  WINNER_MESSAGES,
  WINNER_STATE_KEYS,
  createWinnerCommand,
  getLoserFromWinner,
  getWinnerFromLoser,
  parseWinnerRequest,
};
