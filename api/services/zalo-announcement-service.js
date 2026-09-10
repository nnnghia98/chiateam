const { randomUUID } = require('node:crypto');
const {
  createZaloAnnouncementRepository,
} = require('../routes/zalo-announcements');

const OPERATIONS = Object.freeze([
  'subscribe',
  'unsubscribe',
  'refreshSubscriber',
  'subscribers',
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

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return null;
  return (
    value
      .replace(/[\p{Cc}\s]+/gu, ' ')
      .trim()
      .slice(0, 256) || null
  );
}

function normalizeRequest(operation, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null;
  const p = payload;
  if (['subscribe', 'unsubscribe', 'refreshSubscriber'].includes(operation)) {
    if (!validId(p.chatId) || !validId(p.userId) || p.chatType !== 'private')
      return null;
    return {
      chatId: p.chatId,
      userId: p.userId,
      displayName: normalizeDisplayName(p.displayName),
      ...(operation === 'refreshSubscriber'
        ? {}
        : { subscribed: operation === 'subscribe' }),
    };
  }
  if (operation === 'subscribers') {
    const page = p.page ?? 1;
    if (!Number.isInteger(page) || page < 1 || page > 1000000) return null;
    return { page, pageSize: 10 };
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
    if (operation === 'prepare') {
      const message = typeof p.message === 'string' ? p.message : null;
      let photoUrl = null;
      if (p.photoUrl !== undefined) {
        if (typeof p.photoUrl !== 'string' || p.photoUrl.length > 2048)
          return null;
        try {
          const parsed = new URL(p.photoUrl);
          if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
            return null;
          photoUrl = parsed.toString();
        } catch {
          return null;
        }
      }
      if ((!message || !message.trim()) && !photoUrl) return null;
      if (message && message.length > 2000) return null;
      return {
        id: p.id,
        actorId: p.actorId,
        sourceChatId: p.sourceChatId,
        sourceThreadId: p.sourceThreadId,
        message: message || '',
        ...(photoUrl ? { photoUrl } : {}),
      };
    }
    return {
      id: p.id,
      actorId: p.actorId,
      sourceChatId: p.sourceChatId,
      sourceThreadId: p.sourceThreadId,
      ...(operation === 'prepare' ? { message: p.message, photoUrl: null } : {}),
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
