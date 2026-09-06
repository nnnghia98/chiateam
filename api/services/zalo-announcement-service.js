const { randomUUID } = require('node:crypto');
const {
  createZaloAnnouncementRepository,
} = require('../routes/zalo-announcements');

const OPERATIONS = Object.freeze([
  'subscribe',
  'unsubscribe',
  'prepare',
  'claim',
  'next',
  'record',
  'finish',
  'cancel',
  'status',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_CODES = new Set([
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'API_ERROR',
  'NETWORK_ERROR',
]);
const validId = value =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 256 &&
  !/\s/.test(value);

function normalizeRequest(operation, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null;
  const p = payload;
  if (operation === 'subscribe' || operation === 'unsubscribe') {
    if (!validId(p.chatId) || !validId(p.userId) || p.chatType !== 'private')
      return null;
    return {
      chatId: p.chatId,
      userId: p.userId,
      subscribed: operation === 'subscribe',
    };
  }
  if (operation !== 'prepare' && !UUID.test(p.id || '')) return null;
  if (['prepare', 'claim', 'cancel', 'status'].includes(operation)) {
    if (
      p.platform !== 'telegram' ||
      !validId(p.actorId) ||
      !validId(p.sourceChatId)
    )
      return null;
    if (p.sourceThreadId !== '' && !validId(p.sourceThreadId)) return null;
    if (
      operation === 'prepare' &&
      (typeof p.message !== 'string' ||
        !p.message.trim() ||
        p.message.length > 2000)
    )
      return null;
    return {
      id: p.id,
      actorId: p.actorId,
      sourceChatId: p.sourceChatId,
      sourceThreadId: p.sourceThreadId,
      ...(operation === 'prepare' ? { message: p.message } : {}),
    };
  }
  if (operation === 'record') {
    if (!validId(p.chatId) || !['sent', 'failed', 'unknown'].includes(p.status))
      return null;
    if (p.status !== 'sent' && !ERROR_CODES.has(p.errorCode)) return null;
    return {
      id: p.id,
      chatId: p.chatId,
      status: p.status,
      errorCode: p.status === 'sent' ? null : p.errorCode,
    };
  }
  return { id: p.id };
}

function createZaloAnnouncementService({
  repository = createZaloAnnouncementRepository(),
  createId = randomUUID,
} = {}) {
  return Object.freeze(
    Object.fromEntries(
      OPERATIONS.map(operation => [
        operation,
        async payload => {
          const request = normalizeRequest(operation, payload);
          if (!request)
            return { ok: false, code: 'INVALID_ANNOUNCEMENT_REQUEST' };
          if (operation === 'prepare') request.id = createId();
          const method = ['subscribe', 'unsubscribe'].includes(operation)
            ? 'setSubscription'
            : operation;
          const result = await repository[method](request);
          return { ok: true, result };
        },
      ])
    )
  );
}

module.exports = {
  OPERATIONS,
  normalizeRequest,
  createZaloAnnouncementService,
};
