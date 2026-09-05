const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  assertAnnouncementPublisher,
} = require('../../ports/announcement-publisher');

const MAX_ANNOUNCEMENT_LENGTH = 2000;

const ANNOUNCEMENT_MESSAGES = Object.freeze({
  usage: '⚠️ Cách dùng: /zalosay [nội dung].',
  invalid: '⚠️ Nội dung thông báo phải có từ 1 đến 2000 ký tự.',
  permissionDenied: '⛔ Chỉ admin mới có quyền gửi thông báo.',
  success: '✅ Đã gửi tin nhắn đến Zalo.',
  publishError: '❌ Không thể gửi tin nhắn đến Zalo. Vui lòng thử lại.',
});

function parseAnnouncementRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { ok: false, code: 'MISSING_ANNOUNCEMENT' };
  }

  const message = args.join(' ').trim();

  if (!message || message.length > MAX_ANNOUNCEMENT_LENGTH) {
    return { ok: false, code: 'INVALID_ANNOUNCEMENT' };
  }

  return { ok: true, message };
}

const createSourceResult = text =>
  createTextResult(text, [], { channel: 'source' });

function createAnnouncementCommand({ publisher } = {}) {
  const activePublisher =
    publisher == null ? null : assertAnnouncementPublisher(publisher);

  return createCommandDefinition({
    name: 'zalosay',
    aliases: ['say'],
    instruction: {
      usage: '/zalosay [MESSAGE]',
      description: 'Send a direct bot announcement',
      permission: 'admin',
    },
    stateKeys: [],
    condition: async context => parseAnnouncementRequest(context.args),
    action: async (context, state, condition) => {
      if (!activePublisher) {
        return {
          changed: false,
          code: 'ANNOUNCEMENT_READY',
          message: condition.message,
        };
      }

      try {
        await activePublisher.publish(condition.message, context);
      } catch (error) {
        return {
          changed: false,
          code: 'ANNOUNCEMENT_PUBLISH_FAILED',
          error,
        };
      }

      return {
        changed: false,
        code: 'ANNOUNCEMENT_PUBLISHED',
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createSourceResult(ANNOUNCEMENT_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'MISSING_ANNOUNCEMENT') {
        return createSourceResult(ANNOUNCEMENT_MESSAGES.usage);
      }

      if (outcome.code === 'INVALID_ANNOUNCEMENT') {
        return createSourceResult(ANNOUNCEMENT_MESSAGES.invalid);
      }

      if (outcome.code === 'ANNOUNCEMENT_PUBLISH_FAILED') {
        return createSourceResult(ANNOUNCEMENT_MESSAGES.publishError);
      }

      if (outcome.code === 'ANNOUNCEMENT_PUBLISHED') {
        return createSourceResult(ANNOUNCEMENT_MESSAGES.success);
      }

      return createTextResult(outcome.message, [], {
        channel: 'announcement',
      });
    },
  });
}

module.exports = {
  ANNOUNCEMENT_MESSAGES,
  MAX_ANNOUNCEMENT_LENGTH,
  createAnnouncementCommand,
  parseAnnouncementRequest,
};
