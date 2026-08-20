const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { normalizeStoredSan } = require('./san-command');

const CLEARSAN_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /clearsan không kèm tham số.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  empty: '⚠️ Chưa lưu sân nào. Dùng /san [tên sân] để lưu.',
  success: '✅ Đã xóa sân.',
  loadError: '❌ Không thể tải sân hiện tại từ API.',
  saveError: '❌ Không thể xóa sân. Vui lòng thử lại.',
});

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createClearsanCommand() {
  return createCommandDefinition({
    name: 'clearsan',
    aliases: [],
    instruction: {
      usage: '/clearsan',
      description: 'Clear the current venue',
      permission: 'admin',
    },
    stateKeys: ['san'],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      const currentSan = normalizeStoredSan(state.san);

      if (currentSan === undefined) {
        return { ok: false, code: 'INVALID_SAN_STATE' };
      }

      if (!currentSan) {
        return { ok: false, code: 'SAN_MISSING' };
      }

      return { ok: true };
    },
    action: async () => ({
      changed: true,
      code: 'SAN_CLEARED',
      changes: { san: null },
    }),
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(CLEARSAN_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(CLEARSAN_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_SAN_STATE'
      ) {
        return createDefaultResult(CLEARSAN_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(CLEARSAN_MESSAGES.saveError);
      }

      if (outcome.code === 'SAN_MISSING') {
        return createDefaultResult(CLEARSAN_MESSAGES.empty);
      }

      return createDefaultResult(CLEARSAN_MESSAGES.success);
    },
  });
}

module.exports = {
  CLEARSAN_MESSAGES,
  createClearsanCommand,
};
