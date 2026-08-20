const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  formatMoney,
  normalizeStoredMoney,
  parseMoneyAmount,
} = require('./money');

const TIENNUOC_MESSAGES = Object.freeze({
  invalid: '⚠️ Vui lòng nhập số tiền nguyên không âm. Ví dụ: /tiennuoc 60000',
  permissionDenied: '⛔ Chỉ admin mới có quyền thay đổi tiền nước.',
  empty: '⚠️ Chưa thêm tiền nước.',
  current: '🧊 Tiền nước hiện tại: {value} VND',
  success: '✅ Đã cập nhật tiền nước: {value} VND',
  loadError: '❌ Không thể tải tiền nước hiện tại từ API.',
  saveError: '❌ Không thể lưu tiền nước. Vui lòng thử lại.',
});

function parseTiennuocRequest(args) {
  if (!Array.isArray(args)) {
    return null;
  }

  if (args.length === 0) {
    return { kind: 'read' };
  }

  const amount = parseMoneyAmount(args.join(' '));

  return amount == null ? null : { kind: 'write', amount };
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createAnnouncementResult = text =>
  createTextResult(text, [], { channel: 'announcement' });

function createTiennuocCommand() {
  return createCommandDefinition({
    name: 'tiennuoc',
    aliases: [],
    instruction: {
      usage: '/tiennuoc [AMOUNT]',
      description: 'Read or update the current water fee',
      permission: 'player',
    },
    resolvePermission: context =>
      context.args.length > 0 ? 'admin' : 'player',
    stateKeys: ['tiennuoc'],
    condition: async (context, state) => {
      const request = parseTiennuocRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_AMOUNT' };
      }

      const currentAmount = normalizeStoredMoney(state.tiennuoc);

      if (currentAmount == null) {
        return { ok: false, code: 'INVALID_TIENNUOC_STATE' };
      }

      return { ok: true, request, currentAmount };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'write') {
        return {
          changed: true,
          code: 'TIENNUOC_SAVED',
          changes: { tiennuoc: condition.request.amount },
          amount: condition.request.amount,
        };
      }

      return condition.currentAmount === 0
        ? { changed: false, code: 'TIENNUOC_MISSING' }
        : {
            changed: false,
            code: 'TIENNUOC_CURRENT',
            amount: condition.currentAmount,
          };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(TIENNUOC_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_AMOUNT') {
        return createDefaultResult(TIENNUOC_MESSAGES.invalid);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_TIENNUOC_STATE'
      ) {
        return createDefaultResult(TIENNUOC_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(TIENNUOC_MESSAGES.saveError);
      }

      if (outcome.code === 'TIENNUOC_MISSING') {
        return createDefaultResult(TIENNUOC_MESSAGES.empty);
      }

      if (outcome.code === 'TIENNUOC_CURRENT') {
        return createDefaultResult(
          TIENNUOC_MESSAGES.current.replace(
            '{value}',
            formatMoney(outcome.amount)
          )
        );
      }

      return createAnnouncementResult(
        TIENNUOC_MESSAGES.success.replace(
          '{value}',
          formatMoney(outcome.amount)
        )
      );
    },
  });
}

module.exports = {
  TIENNUOC_MESSAGES,
  createTiennuocCommand,
  parseTiennuocRequest,
};
