const { requestJson } = require('../../bot/utils/api-client');

const VALID_CLAIM_STATES = new Set(['claimed', 'processing', 'completed']);

function createApiWebhookEventRepository({ request = requestJson } = {}) {
  if (typeof request !== 'function') {
    throw new TypeError(
      'API webhook event repository requires a request function.'
    );
  }

  async function claim(event) {
    const result = await request('/api/webhook-events/claim', {
      method: 'POST',
      body: event,
    });

    if (
      result?.ok !== true ||
      !VALID_CLAIM_STATES.has(result.state) ||
      (result.state === 'claimed' && typeof result.claimId !== 'string')
    ) {
      throw new TypeError('Webhook event API returned an invalid claim.');
    }

    return {
      state: result.state,
      claimId: result.state === 'claimed' ? result.claimId : null,
    };
  }

  async function finish(operation, event) {
    const result = await request(`/api/webhook-events/${operation}`, {
      method: 'POST',
      body: event,
    });

    if (result?.ok !== true || typeof result.updated !== 'boolean') {
      throw new TypeError(
        `Webhook event API returned an invalid ${operation} result.`
      );
    }

    return result.updated;
  }

  return Object.freeze({
    claim,
    complete: event => finish('complete', event),
    release: event => finish('release', event),
  });
}

module.exports = {
  VALID_CLAIM_STATES,
  createApiWebhookEventRepository,
};
