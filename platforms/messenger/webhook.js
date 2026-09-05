const { createHmac, timingSafeEqual } = require('node:crypto');
const { extractMessengerMessage, flattenMessengerEvents } = require('./client');

const MESSENGER_WEBHOOK_PLATFORM = 'messenger';

function getHeader(headers, name) {
  if (headers && typeof headers.get === 'function') {
    return headers.get(name);
  }

  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === target
  );
  const value = entry?.[1];

  return Array.isArray(value) ? value[0] : value;
}

function isEqualText(received, expected) {
  const actualBuffer = Buffer.from(String(received ?? ''));
  const expectedBuffer = Buffer.from(String(expected ?? ''));

  return (
    actualBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function verifyMessengerWebhook({
  mode,
  verifyToken,
  challenge,
  expectedToken,
} = {}) {
  if (
    mode !== 'subscribe' ||
    !isEqualText(verifyToken, expectedToken) ||
    challenge == null ||
    String(challenge).length === 0
  ) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  return { statusCode: 200, body: String(challenge) };
}

function normalizeRawBody(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return Buffer.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset || 0, value.byteLength);
  }

  return null;
}

function isValidMessengerSignature(rawBody, signature, appSecret) {
  const bytes = normalizeRawBody(rawBody);
  const header = String(signature ?? '').trim();
  const secret = String(appSecret ?? '');

  if (!bytes || !secret || !/^sha256=[0-9a-f]{64}$/i.test(header)) {
    return false;
  }

  const provided = Buffer.from(header.slice(7), 'hex');
  const expected = createHmac('sha256', secret).update(bytes).digest();

  return timingSafeEqual(expected, provided);
}

function getMessengerEventId(event) {
  const message = extractMessengerMessage(event);
  const pageId = String(message?.pageId ?? '').trim();
  const senderId = String(message?.sender?.id ?? '').trim();
  const messageId = String(message?.mid ?? '').trim();

  return pageId && senderId && messageId
    ? JSON.stringify([pageId, senderId, messageId])
    : null;
}

function assertEventRepository(eventRepository) {
  if (
    eventRepository != null &&
    (typeof eventRepository.claim !== 'function' ||
      typeof eventRepository.complete !== 'function' ||
      typeof eventRepository.release !== 'function')
  ) {
    throw new TypeError('Messenger webhook event repository is invalid.');
  }
}

function createMessengerWebhookHandler({
  adapter,
  appSecret,
  eventRepository,
} = {}) {
  if (!adapter || typeof adapter.handleUpdate !== 'function') {
    throw new TypeError('Messenger webhook requires an adapter.');
  }

  const secret = String(appSecret ?? '');

  if (!secret) {
    throw new TypeError('Messenger webhook app secret is required.');
  }

  assertEventRepository(eventRepository);

  async function handleEvent(event) {
    const eventId = getMessengerEventId(event);

    if (!eventRepository || !eventId) {
      await adapter.handleUpdate(event);
      return null;
    }

    const baseEvent = {
      platform: MESSENGER_WEBHOOK_PLATFORM,
      eventId,
    };
    const claim = await eventRepository.claim(baseEvent);

    if (claim?.state === 'completed') {
      return null;
    }

    if (claim?.state === 'processing') {
      return {
        statusCode: 503,
        headers: { 'Retry-After': '2' },
        body: { ok: false },
      };
    }

    const claimId = String(claim?.claimId ?? '').trim();

    if (claim?.state !== 'claimed' || !claimId) {
      throw new TypeError('Messenger webhook event claim is invalid.');
    }

    const claimedEvent = { ...baseEvent, claimId };

    try {
      await adapter.handleUpdate(event);
      const completed = await eventRepository.complete(claimedEvent);

      if (!completed) {
        throw new Error(
          'Messenger webhook event claim expired before completion.'
        );
      }
    } catch (error) {
      try {
        await eventRepository.release(claimedEvent);
      } catch (releaseError) {
        throw new AggregateError(
          [error, releaseError],
          'Messenger webhook processing and claim release failed.'
        );
      }

      throw error;
    }

    return null;
  }

  return async function handleWebhook({ headers, body, rawBody } = {}) {
    const bytes = normalizeRawBody(rawBody ?? body);

    if (!bytes) {
      return { statusCode: 400, body: { ok: false } };
    }

    const signature = getHeader(headers, 'X-Hub-Signature-256');

    if (!isValidMessengerSignature(bytes, signature, secret)) {
      return { statusCode: 401, body: { ok: false } };
    }

    let payload;

    try {
      payload = JSON.parse(bytes.toString('utf8'));
    } catch {
      return { statusCode: 400, body: { ok: false } };
    }

    if (payload?.object !== 'page') {
      return { statusCode: 200, body: { ok: true } };
    }

    const events = flattenMessengerEvents(payload).filter(event =>
      getMessengerEventId(event)
    );

    for (const event of events) {
      const retry = await handleEvent(event);

      if (retry) {
        return retry;
      }
    }

    return { statusCode: 200, body: { ok: true } };
  };
}

module.exports = {
  MESSENGER_WEBHOOK_PLATFORM,
  createMessengerWebhookHandler,
  getHeader,
  getMessengerEventId,
  isEqualText,
  isValidMessengerSignature,
  normalizeRawBody,
  verifyMessengerWebhook,
};
