const { randomUUID } = require('node:crypto');
const { webhookEventRepository } = require('../routes/webhook-events');

const PLATFORM_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const MAX_EVENT_ID_LENGTH = 512;
const MAX_CLAIM_ID_LENGTH = 128;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWebhookEventIdentity(payload = {}) {
  const platform = normalizeText(payload.platform).toLowerCase();
  const eventId = normalizeText(payload.eventId);

  if (!PLATFORM_PATTERN.test(platform)) {
    return { ok: false, code: 'INVALID_PLATFORM' };
  }

  if (!eventId || eventId.length > MAX_EVENT_ID_LENGTH) {
    return { ok: false, code: 'INVALID_EVENT_ID' };
  }

  return { ok: true, platform, eventId };
}

function normalizeClaimId(value) {
  const claimId = normalizeText(value);
  return claimId && claimId.length <= MAX_CLAIM_ID_LENGTH ? claimId : null;
}

function createWebhookEventService({
  repository = webhookEventRepository,
  createClaimId = randomUUID,
} = {}) {
  if (
    !repository ||
    typeof repository.claim !== 'function' ||
    typeof repository.complete !== 'function' ||
    typeof repository.release !== 'function'
  ) {
    throw new TypeError('Webhook event service requires a repository.');
  }

  if (typeof createClaimId !== 'function') {
    throw new TypeError('Webhook event claim ID factory must be a function.');
  }

  async function claim(payload) {
    const identity = normalizeWebhookEventIdentity(payload);

    if (!identity.ok) {
      return identity;
    }

    const claimId = normalizeClaimId(createClaimId());

    if (!claimId) {
      throw new Error('Webhook event claim ID factory returned an invalid ID.');
    }

    const stored = await repository.claim(
      identity.platform,
      identity.eventId,
      claimId
    );
    const state = stored?.state;

    if (!['claimed', 'processing', 'completed'].includes(state)) {
      throw new Error('Webhook event repository returned an invalid state.');
    }

    return {
      ok: true,
      state,
      claimId: state === 'claimed' ? claimId : null,
    };
  }

  async function finish(payload, operation) {
    const identity = normalizeWebhookEventIdentity(payload);

    if (!identity.ok) {
      return identity;
    }

    const claimId = normalizeClaimId(payload?.claimId);

    if (!claimId) {
      return { ok: false, code: 'INVALID_CLAIM_ID' };
    }

    const updated = await repository[operation](
      identity.platform,
      identity.eventId,
      claimId
    );

    return { ok: true, updated };
  }

  return Object.freeze({
    claim,
    complete: payload => finish(payload, 'complete'),
    release: payload => finish(payload, 'release'),
  });
}

module.exports = {
  MAX_CLAIM_ID_LENGTH,
  MAX_EVENT_ID_LENGTH,
  PLATFORM_PATTERN,
  createWebhookEventService,
  normalizeClaimId,
  normalizeWebhookEventIdentity,
};
