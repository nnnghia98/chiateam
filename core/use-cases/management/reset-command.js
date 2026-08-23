const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  assertAttendanceVoteController,
} = require('../../ports/attendance-vote-controller');

const RESET_STATE_KEYS = Object.freeze([
  'bench',
  'teamA',
  'teamB',
  'team3A',
  'team3B',
  'team3C',
  'manifest',
  'san',
  'tiensan',
  'tiennuoc',
  'teamThua',
  'activeVote',
]);

const RESET_CHANGES = Object.freeze({
  bench: Object.freeze([]),
  teamA: Object.freeze([]),
  teamB: Object.freeze([]),
  team3A: Object.freeze([]),
  team3B: Object.freeze([]),
  team3C: Object.freeze([]),
  manifest: null,
  san: null,
  tiensan: 0,
  tiennuoc: 0,
  teamThua: null,
  activeVote: null,
});

const RESET_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /reset.',
  permissionDenied: '⛔ Chỉ admin mới có quyền reset dữ liệu.',
  success:
    '🔄 ĐÃ RESET TOÀN BỘ DỮ LIỆU TRẬN KẾ TIẾP\n\n' +
    'Đã xóa bench, team, manifest, sân, phí, kết quả và vote.',
  successCloseFailed:
    '🔄 Đã reset dữ liệu, nhưng không thể đóng poll. Hãy đóng poll thủ công.',
  loadError: '❌ Không thể tải dữ liệu hiện tại từ API.',
  saveError: '❌ Không thể reset dữ liệu. Vui lòng thử lại.',
});

function cloneResetChanges() {
  return {
    ...RESET_CHANGES,
    bench: [],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
  };
}

function createResetCommand({ voteController } = {}) {
  const controller = assertAttendanceVoteController(voteController);

  return createCommandDefinition({
    name: 'reset',
    aliases: [],
    instruction: {
      usage: '/reset',
      description: 'Reset all next-match state immediately',
      permission: 'admin',
    },
    stateKeys: [],
    resolveStateKeys: context =>
      context.args.length === 0 ? RESET_STATE_KEYS : [],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      return { ok: true, activeVote: state.activeVote ?? null };
    },
    action: async (context, state, condition) => {
      let closeFailed = false;

      if (condition.activeVote) {
        try {
          await controller.close(condition.activeVote, context);
        } catch (error) {
          closeFailed = true;
        }
      }

      return {
        changed: true,
        code: closeFailed ? 'RESET_DONE_CLOSE_FAILED' : 'RESET_DONE',
        changes: cloneResetChanges(),
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(RESET_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_REQUEST') {
        return createTextResult(RESET_MESSAGES.usage);
      }

      if (outcome.code === 'STATE_LOAD_FAILED') {
        return createTextResult(RESET_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(RESET_MESSAGES.saveError);
      }

      return createTextResult(
        outcome.code === 'RESET_DONE_CLOSE_FAILED'
          ? RESET_MESSAGES.successCloseFailed
          : RESET_MESSAGES.success,
        [],
        { channel: 'announcement' }
      );
    },
  });
}

module.exports = {
  RESET_CHANGES,
  RESET_MESSAGES,
  RESET_STATE_KEYS,
  cloneResetChanges,
  createResetCommand,
};
