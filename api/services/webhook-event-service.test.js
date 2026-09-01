const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createWebhookEventService,
  normalizeWebhookEventIdentity,
} = require('./webhook-event-service');

test('webhook event service validates platform and event IDs', () => {
  assert.deepEqual(
    normalizeWebhookEventIdentity({ platform: ' ZALO ', eventId: ' event-1 ' }),
    { ok: true, platform: 'zalo', eventId: 'event-1' }
  );
  assert.deepEqual(
    normalizeWebhookEventIdentity({ platform: 'bad platform', eventId: '1' }),
    { ok: false, code: 'INVALID_PLATFORM' }
  );
  assert.deepEqual(
    normalizeWebhookEventIdentity({ platform: 'zalo', eventId: '' }),
    { ok: false, code: 'INVALID_EVENT_ID' }
  );
});

test('webhook event service owns claim IDs and maps the lifecycle', async () => {
  const calls = [];
  const service = createWebhookEventService({
    createClaimId: () => 'claim-1',
    repository: {
      async claim(...args) {
        calls.push(['claim', ...args]);
        return { state: 'claimed' };
      },
      async complete(...args) {
        calls.push(['complete', ...args]);
        return true;
      },
      async release(...args) {
        calls.push(['release', ...args]);
        return false;
      },
    },
  });
  const event = { platform: 'zalo', eventId: 'event-1' };

  assert.deepEqual(await service.claim(event), {
    ok: true,
    state: 'claimed',
    claimId: 'claim-1',
  });
  assert.deepEqual(await service.complete({ ...event, claimId: 'claim-1' }), {
    ok: true,
    updated: true,
  });
  assert.deepEqual(await service.release({ ...event, claimId: 'claim-1' }), {
    ok: true,
    updated: false,
  });
  assert.deepEqual(calls, [
    ['claim', 'zalo', 'event-1', 'claim-1'],
    ['complete', 'zalo', 'event-1', 'claim-1'],
    ['release', 'zalo', 'event-1', 'claim-1'],
  ]);
});

test('webhook event service hides claim IDs for duplicate events', async () => {
  const service = createWebhookEventService({
    createClaimId: () => 'unused-claim',
    repository: {
      claim: async () => ({ state: 'completed' }),
      complete: async () => true,
      release: async () => true,
    },
  });

  assert.deepEqual(
    await service.claim({ platform: 'zalo', eventId: 'event-1' }),
    { ok: true, state: 'completed', claimId: null }
  );
});
