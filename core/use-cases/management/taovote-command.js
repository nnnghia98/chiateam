const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  assertAttendanceVotePublisher,
} = require('../../ports/attendance-vote-publisher');
const { ATTENDANCE_VOTE_OPTIONS } = require('./attendance-vote');

const MAX_VOTE_QUESTION_LENGTH = 300;

const TAOVOTE_MESSAGES = Object.freeze({
  prompt: '📊 Nhập câu hỏi cho vote mới.',
  invalid: '⚠️ Câu hỏi vote phải có từ 1 đến 300 ký tự. Vui lòng nhập lại.',
  permissionDenied: '⛔ Chỉ admin mới có quyền tạo vote.',
  voteExists:
    '⚠️ Hiện tại đã có một vote đang hoạt động. Hãy đóng vote đó trước khi tạo vote mới.',
  success: '✅ Đã tạo vote: {question}',
  loadError: '❌ Không thể tải vote hiện tại từ API.',
  publishError: '❌ Không thể gửi vote. Vui lòng thử lại.',
  saveError:
    '❌ Vote đã được gửi nhưng không thể lưu trạng thái. Vui lòng xóa poll thủ công rồi thử lại.',
});

function parseTaovoteRequest(args) {
  if (!Array.isArray(args)) {
    return null;
  }

  if (args.length === 0) {
    return { kind: 'prompt' };
  }

  const question = args.join(' ').trim();

  if (!question || question.length > MAX_VOTE_QUESTION_LENGTH) {
    return null;
  }

  return { kind: 'create', question };
}

function normalizeActiveVote(value) {
  if (value == null) {
    return { ok: true, activeVote: null };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, activeVote: null };
  }

  return { ok: true, activeVote: value };
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getCreatorName(actor) {
  return actor.displayName || actor.username || actor.externalId;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createTaovoteCommand({ votePublisher, now = () => new Date() } = {}) {
  const publisher = assertAttendanceVotePublisher(votePublisher);

  if (typeof now !== 'function') {
    throw new TypeError('Taovote clock must be a function.');
  }

  return createCommandDefinition({
    name: 'taopoll',
    aliases: ['taovote'],
    instruction: {
      usage: '/taopoll [QUESTION]',
      description: 'Create one attendance vote',
      permission: 'player',
    },
    resolvePermission: () => 'admin',
    stateKeys: ['activeVote'],
    condition: async (context, state) => {
      const request = parseTaovoteRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_QUESTION' };
      }

      const normalized = normalizeActiveVote(state.activeVote);

      if (!normalized.ok) {
        return { ok: false, code: 'INVALID_VOTE_STATE' };
      }

      if (normalized.activeVote) {
        return { ok: false, code: 'VOTE_EXISTS' };
      }

      return { ok: true, request, activeVote: null };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'prompt') {
        return { changed: false, code: 'VOTE_QUESTION_REQUESTED' };
      }

      const createdAt = toIsoTimestamp(now());

      if (!createdAt) {
        return { changed: false, code: 'VOTE_PUBLISH_FAILED' };
      }

      const createdBy = getCreatorName(context.actor);
      const draft = Object.freeze({
        question: condition.request.question,
        options: ATTENDANCE_VOTE_OPTIONS,
        createdBy,
        createdAt,
      });
      let reference;

      try {
        reference = await publisher.publish(draft, context);
      } catch (error) {
        return {
          changed: false,
          code: 'VOTE_PUBLISH_FAILED',
          error,
        };
      }

      const activeVote = {
        id: reference.id,
        question: draft.question,
        options: [...draft.options],
        chatId: reference.chatId || context.conversation.externalId,
        messageId: reference.messageId,
        platform: reference.platform,
        createdBy,
        createdAt,
        totalVoters: 0,
        votes: {},
      };

      return {
        changed: true,
        code: 'VOTE_CREATED',
        changes: { activeVote },
        question: draft.question,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(TAOVOTE_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'VOTE_QUESTION_REQUESTED') {
        return createTextResult(TAOVOTE_MESSAGES.prompt, [], {
          channel: 'default',
          input: { command: 'taopoll' },
        });
      }

      if (outcome.code === 'INVALID_QUESTION') {
        return createTextResult(TAOVOTE_MESSAGES.invalid, [], {
          channel: 'default',
          input: { command: 'taopoll' },
        });
      }

      if (outcome.code === 'VOTE_EXISTS') {
        return createDefaultResult(TAOVOTE_MESSAGES.voteExists);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_VOTE_STATE'
      ) {
        return createDefaultResult(TAOVOTE_MESSAGES.loadError);
      }

      if (outcome.code === 'VOTE_PUBLISH_FAILED') {
        return createDefaultResult(TAOVOTE_MESSAGES.publishError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(TAOVOTE_MESSAGES.saveError);
      }

      return createDefaultResult(
        TAOVOTE_MESSAGES.success.replace('{question}', outcome.question)
      );
    },
  });
}

module.exports = {
  ATTENDANCE_VOTE_OPTIONS,
  MAX_VOTE_QUESTION_LENGTH,
  TAOVOTE_MESSAGES,
  createTaovoteCommand,
  parseTaovoteRequest,
};
