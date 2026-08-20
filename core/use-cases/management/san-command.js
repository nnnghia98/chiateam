const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');

const SAN_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /san để xem sân hoặc /san [tên sân] để lưu.',
  permissionDenied: '⛔ Chỉ admin mới có quyền thay đổi sân.',
  noSan: '⚠️ Chưa lưu sân nào. Dùng /san [tên sân] để lưu.',
  current: 'Sân: {value}',
  success: '✅ Đã lưu sân: {value}',
  loadError: '❌ Không thể tải sân hiện tại từ API.',
  saveError: '❌ Không thể lưu sân. Vui lòng thử lại.',
});

function parseSanRequest(args) {
  if (!Array.isArray(args)) {
    return null;
  }

  if (args.length === 0) {
    return { kind: 'read' };
  }

  const venue = args.join(' ').trim().replace(/\s+/g, ' ');

  return venue ? { kind: 'write', venue } : null;
}

function normalizeStoredSan(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim() || null;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createAnnouncementResult = text =>
  createTextResult(text, [], { channel: 'announcement' });

function createSanCommand() {
  return createCommandDefinition({
    name: 'san',
    aliases: [],
    instruction: {
      usage: '/san [NAME]',
      description: 'Read or update the current venue',
      permission: 'player',
    },
    resolvePermission: context =>
      context.args.length > 0 ? 'admin' : 'player',
    stateKeys: ['san'],
    condition: async (context, state) => {
      const request = parseSanRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      const currentSan = normalizeStoredSan(state.san);

      if (currentSan === undefined) {
        return { ok: false, code: 'INVALID_SAN_STATE' };
      }

      return { ok: true, request, currentSan };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'write') {
        return {
          changed: true,
          code: 'SAN_SAVED',
          changes: { san: condition.request.venue },
          venue: condition.request.venue,
        };
      }

      return condition.currentSan
        ? {
            changed: false,
            code: 'SAN_CURRENT',
            venue: condition.currentSan,
          }
        : { changed: false, code: 'SAN_MISSING' };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(SAN_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_REQUEST') {
        return createDefaultResult(SAN_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_SAN_STATE'
      ) {
        return createDefaultResult(SAN_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(SAN_MESSAGES.saveError);
      }

      if (outcome.code === 'SAN_MISSING') {
        return createDefaultResult(SAN_MESSAGES.noSan);
      }

      if (outcome.code === 'SAN_CURRENT') {
        return createAnnouncementResult(
          SAN_MESSAGES.current.replace('{value}', outcome.venue)
        );
      }

      return createDefaultResult(
        SAN_MESSAGES.success.replace('{value}', outcome.venue)
      );
    },
  });
}

module.exports = {
  SAN_MESSAGES,
  createSanCommand,
  normalizeStoredSan,
  parseSanRequest,
};
