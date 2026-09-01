const { db } = require('../db/config');

const DEFAULT_PROCESSING_LEASE_SECONDS = 5 * 60;
const DEFAULT_COMPLETED_RETENTION_SECONDS = 24 * 60 * 60;
const tableReadyByDatabase = new WeakMap();

function ensureWebhookEventsTable(database = db) {
  if (!database || typeof database.query !== 'function') {
    throw new TypeError('Webhook event repository requires a database.');
  }

  let tableReady = tableReadyByDatabase.get(database);

  if (!tableReady) {
    tableReady = database
      .query(
        `
        CREATE TABLE IF NOT EXISTS webhook_events (
          platform TEXT NOT NULL,
          event_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
          claim_id TEXT,
          lease_expires_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (platform, event_id)
        )
      `
      )
      .then(() =>
        database.query(`
          CREATE INDEX IF NOT EXISTS webhook_events_expiry_idx
          ON webhook_events (expires_at)
        `)
      )
      .catch(error => {
        tableReadyByDatabase.delete(database);
        throw error;
      });

    tableReadyByDatabase.set(database, tableReady);
  }

  return tableReady;
}

function createWebhookEventRepository({
  database = db,
  processingLeaseSeconds = DEFAULT_PROCESSING_LEASE_SECONDS,
  completedRetentionSeconds = DEFAULT_COMPLETED_RETENTION_SECONDS,
} = {}) {
  if (
    !Number.isInteger(processingLeaseSeconds) ||
    processingLeaseSeconds <= 0
  ) {
    throw new TypeError('Webhook processing lease must be a positive integer.');
  }

  if (
    !Number.isInteger(completedRetentionSeconds) ||
    completedRetentionSeconds <= 0
  ) {
    throw new TypeError(
      'Webhook completed retention must be a positive integer.'
    );
  }

  async function claim(platform, eventId, claimId) {
    await ensureWebhookEventsTable(database);
    const result = await database.query(
      `
        WITH deleted AS (
          DELETE FROM webhook_events
          WHERE status = 'completed'
            AND expires_at <= NOW()
          RETURNING 1
        ), claimed AS (
          INSERT INTO webhook_events (
            platform,
            event_id,
            status,
            claim_id,
            lease_expires_at,
            expires_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            'processing',
            $3,
            NOW() + ($4 * INTERVAL '1 second'),
            NULL,
            NOW(),
            NOW()
          )
          ON CONFLICT (platform, event_id)
          DO UPDATE SET
            status = 'processing',
            claim_id = EXCLUDED.claim_id,
            lease_expires_at = EXCLUDED.lease_expires_at,
            expires_at = NULL,
            updated_at = NOW()
          WHERE (
            webhook_events.status = 'processing'
            AND webhook_events.lease_expires_at <= NOW()
          ) OR (
            webhook_events.status = 'completed'
            AND webhook_events.expires_at <= NOW()
          )
          RETURNING claim_id
        )
        SELECT 'claimed' AS state, claim_id
        FROM claimed
        UNION ALL
        SELECT webhook_events.status AS state, NULL::TEXT AS claim_id
        FROM webhook_events
        WHERE platform = $1
          AND event_id = $2
          AND NOT EXISTS (SELECT 1 FROM claimed)
        LIMIT 1
      `,
      [platform, eventId, claimId, processingLeaseSeconds]
    );

    return result.rows[0] || { state: 'processing', claim_id: null };
  }

  async function complete(platform, eventId, claimId) {
    await ensureWebhookEventsTable(database);
    const result = await database.query(
      `
        UPDATE webhook_events
        SET
          status = 'completed',
          claim_id = NULL,
          lease_expires_at = NULL,
          expires_at = NOW() + ($4 * INTERVAL '1 second'),
          updated_at = NOW()
        WHERE platform = $1
          AND event_id = $2
          AND status = 'processing'
          AND claim_id = $3
        RETURNING event_id
      `,
      [platform, eventId, claimId, completedRetentionSeconds]
    );

    return result.rowCount === 1;
  }

  async function release(platform, eventId, claimId) {
    await ensureWebhookEventsTable(database);
    const result = await database.query(
      `
        DELETE FROM webhook_events
        WHERE platform = $1
          AND event_id = $2
          AND status = 'processing'
          AND claim_id = $3
        RETURNING event_id
      `,
      [platform, eventId, claimId]
    );

    return result.rowCount === 1;
  }

  return Object.freeze({ claim, complete, release });
}

const webhookEventRepository = createWebhookEventRepository();

module.exports = {
  DEFAULT_COMPLETED_RETENTION_SECONDS,
  DEFAULT_PROCESSING_LEASE_SECONDS,
  createWebhookEventRepository,
  ensureWebhookEventsTable,
  webhookEventRepository,
};
