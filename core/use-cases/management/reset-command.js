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
  usage: '⚠️ Dùng /reset, /reset confirm hoặc /reset cancel.',
  permissionDenied: '⛔ Chỉ admin mới có quyền reset dữ liệu.',
  confirmation:
    '⚠️ Reset toàn bộ dữ liệu trận kế tiếp?\nDùng /reset confirm để xác nhận.',
  cancelled: '✅ Đã hủy reset.',
  success:
    '🔄 ĐÃ RESET TOÀN BỘ DỮ LIỆU TRẬN KẾ TIẾP\n\n' +
    'Đã xóa bench, team, manifest, sân, phí, kết quả và vote.',
  successCloseFailed:
    '🔄 Đã reset dữ liệu, nhưng không thể đóng poll. Hãy đóng poll thủ công.',
  loadError: '❌ Không thể tải dữ liệu hiện tại từ API.',
  saveError: '❌ Không thể reset dữ liệu. Vui lòng thử lại.',
});

function parseResetRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'confirm' };
  }

  if (args.length !== 1) return null;
  const action = String(args[0]).toLowerCase();
  if (action === 'confirm') return { kind: 'reset' };
  if (action === 'cancel') return { kind: 'cancel' };
  return null;
}

function createResetActions() {
  return [
    {
      id: 'reset_confirm',
      label: '✅ Xác nhận',
      command: '/reset confirm',
    },
    { id: 'reset_cancel', label: 'Hủy', command: '/reset cancel' },
  ];
}

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
      usage: '/reset [confirm|cancel]',
      description: 'Reset all next-match state after confirmation',
      permission: 'admin',
    },
    stateKeys: [],
    resolveStateKeys: context =>
      String(context.args[0] ?? '').toLowerCase() === 'confirm'
        ? RESET_STATE_KEYS
        : [],
    condition: async (context, state) => {
      const request = parseResetRequest(context.args);

      return request
        ? { ok: true, request, activeVote: state.activeVote ?? null }
        : { ok: false, code: 'INVALID_REQUEST' };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'confirm') {
        return { changed: false, code: 'CONFIRMATION_REQUIRED' };
      }

      if (condition.request.kind === 'cancel') {
        return { changed: false, code: 'RESET_CANCELLED' };
      }

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

      if (outcome.code === 'CONFIRMATION_REQUIRED') {
        return createTextResult(
          RESET_MESSAGES.confirmation,
          createResetActions()
        );
      }

      if (outcome.code === 'RESET_CANCELLED') {
        return createTextResult(RESET_MESSAGES.cancelled);
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
  createResetActions,
  createResetCommand,
  parseResetRequest,
};
