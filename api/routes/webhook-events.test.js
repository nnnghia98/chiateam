const test = require('node:test');
const assert = require('node:assert/strict');

const { createWebhookEventRepository } = require('./webhook-events');

test('webhook event database repository claims, completes, and releases', async () => {
  const calls = [];
  const responses = [
    { rowCount: 0, rows: [] },
    { rowCount: 0, rows: [] },
    { rowCount: 1, rows: [{ state: 'claimed', claim_id: 'claim-1' }] },
    { rowCount: 1, rows: [{ event_id: 'event-1' }] },
    { rowCount: 1, rows: [{ event_id: 'event-2' }] },
  ];
  const database = {
    async query(sql, values) {
      calls.push({ sql, values });
      return responses.shift();
    },
  };
  const repository = createWebhookEventRepository({
    database,
    processingLeaseSeconds: 60,
    completedRetentionSeconds: 3600,
  });

  assert.deepEqual(await repository.claim('zalo', 'event-1', 'claim-1'), {
    state: 'claimed',
    claim_id: 'claim-1',
  });
  assert.equal(await repository.complete('zalo', 'event-1', 'claim-1'), true);
  assert.equal(await repository.release('zalo', 'event-2', 'claim-2'), true);

  assert.equal(calls.length, 5);
  assert.match(calls[0].sql, /CREATE TABLE IF NOT EXISTS webhook_events/);
  assert.match(calls[1].sql, /CREATE INDEX IF NOT EXISTS/);
  assert.deepEqual(calls[2].values, ['zalo', 'event-1', 'claim-1', 60]);
  assert.deepEqual(calls[3].values, ['zalo', 'event-1', 'claim-1', 3600]);
  assert.deepEqual(calls[4].values, ['zalo', 'event-2', 'claim-2']);
});
