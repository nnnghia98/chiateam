const { timingSafeEqual } = require('node:crypto');
const { extractZaloMessage } = require('./client');

const ZALO_WEBHOOK_PLATFORM = 'zalo';

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

function isValidWebhookSecret(received, expected) {
  const actualBuffer = Buffer.from(String(received ?? ''));
  const expectedBuffer = Buffer.from(String(expected ?? ''));

  return (
    actualBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function getZaloWebhookEventId(update) {
  const message = extractZaloMessage(update);
  const chatId = String(message?.chat?.id ?? '').trim();
  const messageId = String(message?.message_id ?? '').trim();

  return chatId && messageId ? JSON.stringify([chatId, messageId]) : null;
}

function createZaloWebhookHandler({
  adapter,
  secretToken,
  eventRepository,
} = {}) {
  if (!adapter || typeof adapter.handleUpdate !== 'function') {
    throw new TypeError('Zalo webhook requires an adapter.');
  }

  const secret = String(secretToken ?? '');

  if (secret.length < 8 || secret.length > 256) {
    throw new RangeError(
      'Zalo webhook secret must contain 8 to 256 characters.'
    );
  }

  if (
    eventRepository != null &&
    (typeof eventRepository.claim !== 'function' ||
      typeof eventRepository.complete !== 'function' ||
      typeof eventRepository.release !== 'function')
  ) {
    throw new TypeError('Zalo webhook event repository is invalid.');
  }

  return async function handleWebhook({ headers, body } = {}) {
    const receivedSecret = getHeader(headers, 'X-Bot-Api-Secret-Token');

    if (!isValidWebhookSecret(receivedSecret, secret)) {
      return { statusCode: 403, body: { ok: false } };
    }

    let update = body;

    if (typeof body === 'string') {
      const rawBody = body.trim();

      if (!rawBody) {
        update = {};
      } else {
        try {
          update = JSON.parse(rawBody);
        } catch {
          return { statusCode: 400, body: { ok: false } };
        }
      }
    }

    const eventId = getZaloWebhookEventId(update);

    if (!eventRepository || !eventId) {
      await adapter.handleUpdate(update);
      return { statusCode: 200, body: { ok: true } };
    }

    const event = { platform: ZALO_WEBHOOK_PLATFORM, eventId };
    const claim = await eventRepository.claim(event);

    if (claim?.state === 'completed') {
      return { statusCode: 200, body: { ok: true } };
    }

    if (claim?.state === 'processing') {
      return {
        statusCode: 503,
        headers: { 'Retry-After': '2' },
        body: { ok: false },
      };
    }

    if (claim?.state !== 'claimed' || typeof claim.claimId !== 'string') {
      throw new TypeError('Zalo webhook event claim is invalid.');
    }

    const claimedEvent = { ...event, claimId: claim.claimId };

    try {
      await adapter.handleUpdate(update);
      const completed = await eventRepository.complete(claimedEvent);

      if (!completed) {
        throw new Error('Zalo webhook event claim expired before completion.');
      }
    } catch (error) {
      try {
        await eventRepository.release(claimedEvent);
      } catch (releaseError) {
        throw new AggregateError(
          [error, releaseError],
          'Zalo webhook processing and claim release failed.'
        );
      }

      throw error;
    }

    return { statusCode: 200, body: { ok: true } };
  };
}

module.exports = {
  createZaloWebhookHandler,
  getHeader,
  getZaloWebhookEventId,
  isValidWebhookSecret,
  ZALO_WEBHOOK_PLATFORM,
};
