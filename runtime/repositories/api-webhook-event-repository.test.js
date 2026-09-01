const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApiWebhookEventRepository,
} = require('./api-webhook-event-repository');

test('API webhook event repository maps the claim lifecycle', async () => {
  const calls = [];
  const repository = createApiWebhookEventRepository({
    async request(path, options) {
      calls.push({ path, options });

      if (path.endsWith('/claim')) {
        return { ok: true, state: 'claimed', claimId: 'claim-1' };
      }

      return { ok: true, updated: true };
    },
  });
  const event = { platform: 'zalo', eventId: 'event-1' };

  assert.deepEqual(await repository.claim(event), {
    state: 'claimed',
    claimId: 'claim-1',
  });
  assert.equal(
    await repository.complete({ ...event, claimId: 'claim-1' }),
    true
  );
  assert.equal(
    await repository.release({ ...event, claimId: 'claim-1' }),
    true
  );
  assert.deepEqual(
    calls.map(call => [call.path, call.options.method]),
    [
      ['/api/webhook-events/claim', 'POST'],
      ['/api/webhook-events/complete', 'POST'],
      ['/api/webhook-events/release', 'POST'],
    ]
  );
});

test('API webhook event repository rejects malformed API responses', async () => {
  const repository = createApiWebhookEventRepository({
    request: async () => ({ ok: true, state: 'unknown' }),
  });

  await assert.rejects(
    repository.claim({ platform: 'zalo', eventId: 'event-1' }),
    /invalid claim/
  );
});
