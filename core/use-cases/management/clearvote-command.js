const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  assertAttendanceVoteController,
} = require('../../ports/attendance-vote-controller');

const CLEARVOTE_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /clearvote, /clearvote confirm hoặc /clearvote cancel.',
  permissionDenied: '⛔ Chỉ admin mới có quyền xóa vote.',
  confirmation:
    '⚠️ Đóng và xóa vote hiện tại?\nDùng /clearvote confirm để xác nhận.',
  cancelled: '✅ Đã hủy xóa vote.',
  noVote: '📭 Không có vote nào đang hoạt động để xóa.',
  success: '🗑️ Đã đóng và xóa vote.',
  clearedOnly:
    '🗑️ Đã xóa trạng thái vote. Không thể đóng poll trên nền tảng hiện tại.',
  closeFailed:
    '⚠️ Đã xóa trạng thái vote nhưng không thể đóng poll. Hãy đóng poll thủ công.',
  loadError: '❌ Không thể tải vote hiện tại từ API.',
  saveError:
    '❌ Poll có thể đã được đóng nhưng không thể xóa trạng thái vote. Hãy thử lại.',
});

function parseClearvoteRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'confirm' };
  }

  if (args.length !== 1) {
    return null;
  }

  const action = String(args[0]).trim().toLowerCase();

  if (action === 'confirm') {
    return { kind: 'clear' };
  }

  if (action === 'cancel') {
    return { kind: 'cancel' };
  }

  return null;
}

function createClearvoteActions() {
  return [
    {
      id: 'clearvote_confirm',
      label: '✅ Xác nhận',
      command: '/clearvote confirm',
    },
    {
      id: 'clearvote_cancel',
      label: 'Hủy',
      command: '/clearvote cancel',
    },
  ];
}

function createClearvoteCommand({ voteController } = {}) {
  const controller = assertAttendanceVoteController(voteController);

  return createCommandDefinition({
    name: 'clearvote',
    aliases: [],
    instruction: {
      usage: '/clearvote [confirm|cancel]',
      description: 'Close and clear the active attendance vote',
      permission: 'admin',
    },
    stateKeys: ['activeVote'],
    condition: async (context, state) => {
      const request = parseClearvoteRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      if (request.kind === 'cancel') {
        return { ok: true, request, activeVote: null };
      }

      if (state.activeVote == null) {
        return { ok: false, code: 'NO_ACTIVE_VOTE' };
      }

      if (
        typeof state.activeVote !== 'object' ||
        Array.isArray(state.activeVote)
      ) {
        return { ok: false, code: 'INVALID_VOTE_STATE' };
      }

      return { ok: true, request, activeVote: state.activeVote };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'cancel') {
        return { changed: false, code: 'CLEAR_CANCELLED' };
      }

      if (condition.request.kind === 'confirm') {
        return { changed: false, code: 'CONFIRMATION_REQUIRED' };
      }

      let closed = false;
      let closeFailed = false;

      try {
        const result = await controller.close(condition.activeVote, context);
        closed = result.closed;
      } catch (error) {
        closeFailed = true;
      }

      return {
        changed: true,
        code: closeFailed
          ? 'VOTE_CLEARED_CLOSE_FAILED'
          : closed
            ? 'VOTE_CLOSED_AND_CLEARED'
            : 'VOTE_CLEARED',
        changes: { activeVote: null },
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(CLEARVOTE_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_REQUEST') {
        return createTextResult(CLEARVOTE_MESSAGES.usage);
      }

      if (outcome.code === 'NO_ACTIVE_VOTE') {
        return createTextResult(CLEARVOTE_MESSAGES.noVote);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_VOTE_STATE'
      ) {
        return createTextResult(CLEARVOTE_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(CLEARVOTE_MESSAGES.saveError);
      }

      if (outcome.code === 'CLEAR_CANCELLED') {
        return createTextResult(CLEARVOTE_MESSAGES.cancelled);
      }

      if (outcome.code === 'CONFIRMATION_REQUIRED') {
        return createTextResult(
          CLEARVOTE_MESSAGES.confirmation,
          createClearvoteActions()
        );
      }

      if (outcome.code === 'VOTE_CLEARED_CLOSE_FAILED') {
        return createTextResult(CLEARVOTE_MESSAGES.closeFailed);
      }

      if (outcome.code === 'VOTE_CLEARED') {
        return createTextResult(CLEARVOTE_MESSAGES.clearedOnly);
      }

      return createTextResult(CLEARVOTE_MESSAGES.success);
    },
  });
}

module.exports = {
  CLEARVOTE_MESSAGES,
  createClearvoteActions,
  createClearvoteCommand,
  parseClearvoteRequest,
};
