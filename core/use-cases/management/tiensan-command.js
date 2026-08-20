const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  formatMoney,
  normalizeStoredMoney,
  parseMoneyAmount,
} = require('./money');

const TIENSAN_MESSAGES = Object.freeze({
  invalid: '⚠️ Vui lòng nhập số tiền nguyên không âm. Ví dụ: /tiensan 500000',
  permissionDenied: '⛔ Chỉ admin mới có quyền thay đổi tiền sân.',
  empty: '⚠️ Chưa thêm tiền sân.',
  current: '💰 Tiền sân hiện tại: {value} VND',
  success: '✅ Đã cập nhật tiền sân: {value} VND',
  loadError: '❌ Không thể tải tiền sân hiện tại từ API.',
  saveError: '❌ Không thể lưu tiền sân. Vui lòng thử lại.',
});

function parseTiensanRequest(args) {
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

function createTiensanCommand() {
  return createCommandDefinition({
    name: 'tiensan',
    aliases: [],
    instruction: {
      usage: '/tiensan [AMOUNT]',
      description: 'Read or update the current venue fee',
      permission: 'player',
    },
    resolvePermission: context =>
      context.args.length > 0 ? 'admin' : 'player',
    stateKeys: ['tiensan'],
    condition: async (context, state) => {
      const request = parseTiensanRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_AMOUNT' };
      }

      const currentAmount = normalizeStoredMoney(state.tiensan);

      if (currentAmount == null) {
        return { ok: false, code: 'INVALID_TIENSAN_STATE' };
      }

      return { ok: true, request, currentAmount };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'write') {
        return {
          changed: true,
          code: 'TIENSAN_SAVED',
          changes: { tiensan: condition.request.amount },
          amount: condition.request.amount,
        };
      }

      return condition.currentAmount === 0
        ? { changed: false, code: 'TIENSAN_MISSING' }
        : {
            changed: false,
            code: 'TIENSAN_CURRENT',
            amount: condition.currentAmount,
          };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(TIENSAN_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_AMOUNT') {
        return createDefaultResult(TIENSAN_MESSAGES.invalid);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_TIENSAN_STATE'
      ) {
        return createDefaultResult(TIENSAN_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(TIENSAN_MESSAGES.saveError);
      }

      if (outcome.code === 'TIENSAN_MISSING') {
        return createDefaultResult(TIENSAN_MESSAGES.empty);
      }

      if (outcome.code === 'TIENSAN_CURRENT') {
        return createDefaultResult(
          TIENSAN_MESSAGES.current.replace(
            '{value}',
            formatMoney(outcome.amount)
          )
        );
      }

      return createAnnouncementResult(
        TIENSAN_MESSAGES.success.replace('{value}', formatMoney(outcome.amount))
      );
    },
  });
}

module.exports = {
  TIENSAN_MESSAGES,
  createTiensanCommand,
  parseTiensanRequest,
};
