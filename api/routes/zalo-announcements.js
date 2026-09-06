const { db } = require('../db/config');

const readyByDatabase = new WeakMap();

function ensureZaloAnnouncementTables(database = db) {
  if (!readyByDatabase.has(database)) {
    const ready = database
      .query(
        `
      CREATE TABLE IF NOT EXISTS zalo_announcement_subscriptions (
        chat_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        subscribed BOOLEAN NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS zalo_announcements (
        id UUID PRIMARY KEY,
        actor_id TEXT NOT NULL,
        source_chat_id TEXT NOT NULL,
        source_thread_id TEXT NOT NULL,
        message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
        status TEXT NOT NULL CHECK (status IN ('draft', 'sending', 'finished', 'cancelled')),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS zalo_announcement_deliveries (
        announcement_id UUID NOT NULL REFERENCES zalo_announcements(id),
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'unknown', 'skipped')),
        error_code TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (announcement_id, chat_id)
      );
      ALTER TABLE zalo_announcement_subscriptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE zalo_announcements ENABLE ROW LEVEL SECURITY;
      ALTER TABLE zalo_announcement_deliveries ENABLE ROW LEVEL SECURITY;
    `
      )
      .catch(error => {
        readyByDatabase.delete(database);
        throw error;
      });
    readyByDatabase.set(database, ready);
  }
  return readyByDatabase.get(database);
}

function createZaloAnnouncementRepository({ database = db } = {}) {
  async function query(sql, values) {
    await ensureZaloAnnouncementTables(database);
    return database.query(sql, values);
  }

  const identity = p => [p.id, p.actorId, p.sourceChatId, p.sourceThreadId];
  const ownsDraft = `id = $1 AND actor_id = $2 AND source_chat_id = $3 AND source_thread_id = $4`;

  return Object.freeze({
    async setSubscription({ chatId, userId, subscribed }) {
      await query(
        `
        INSERT INTO zalo_announcement_subscriptions (chat_id, user_id, subscribed)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          chat_id = EXCLUDED.chat_id, subscribed = EXCLUDED.subscribed, updated_at = NOW()
      `,
        [chatId, userId, subscribed]
      );
      return { subscribed };
    },

    async prepare(p) {
      const result = await query(
        `
        WITH draft AS (
          INSERT INTO zalo_announcements
            (id, actor_id, source_chat_id, source_thread_id, message, status, expires_at)
          VALUES ($1, $2, $3, $4, $5, 'draft', NOW() + INTERVAL '10 minutes')
          RETURNING id, expires_at
        ), recipients AS (
          INSERT INTO zalo_announcement_deliveries (announcement_id, chat_id, user_id, status)
          SELECT draft.id, s.chat_id, s.user_id, 'pending'
          FROM draft CROSS JOIN zalo_announcement_subscriptions s
          WHERE s.subscribed = TRUE
          RETURNING chat_id
        )
        SELECT draft.id, draft.expires_at AS "expiresAt",
          (SELECT COUNT(*)::INTEGER FROM recipients) AS total FROM draft
      `,
        [...identity(p), p.message]
      );
      return result.rows[0];
    },

    async claim(p) {
      const result = await query(
        `
        UPDATE zalo_announcements SET status = 'sending'
        WHERE ${ownsDraft} AND status = 'draft' AND expires_at > NOW()
        RETURNING id, message
      `,
        identity(p)
      );
      return result.rows[0] || null;
    },

    async next({ id }) {
      // Recheck opt-out at dispatch, including changes made after the preview.
      await query(
        `
        UPDATE zalo_announcement_deliveries d SET status = 'skipped', updated_at = NOW()
        WHERE d.announcement_id = $1 AND d.status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM zalo_announcement_subscriptions s
            WHERE s.chat_id = d.chat_id AND s.user_id = d.user_id AND s.subscribed = TRUE
          )
      `,
        [id]
      );
      const result = await query(
        `
        WITH candidate AS (
          SELECT d.announcement_id, d.chat_id
          FROM zalo_announcement_deliveries d
          JOIN zalo_announcements a ON a.id = d.announcement_id
          JOIN zalo_announcement_subscriptions s ON s.chat_id = d.chat_id AND s.user_id = d.user_id
          WHERE d.announcement_id = $1 AND a.status = 'sending'
            AND d.status = 'pending' AND s.subscribed = TRUE
          ORDER BY d.chat_id LIMIT 1 FOR UPDATE OF d SKIP LOCKED
        )
        UPDATE zalo_announcement_deliveries d SET status = 'sending', updated_at = NOW()
        FROM candidate c
        WHERE d.announcement_id = c.announcement_id AND d.chat_id = c.chat_id
          AND d.status = 'pending'
        RETURNING d.chat_id AS "chatId"
      `,
        [id]
      );
      return result.rows[0] || null;
    },

    async record({ id, chatId, status, errorCode }) {
      const result = await query(
        `
        UPDATE zalo_announcement_deliveries SET status = $3, error_code = $4, updated_at = NOW()
        WHERE announcement_id = $1 AND chat_id = $2 AND status = 'sending'
        RETURNING chat_id
      `,
        [id, chatId, status, errorCode]
      );
      return result.rowCount === 1;
    },

    async finish({ id }) {
      await query(
        `UPDATE zalo_announcements SET status = 'finished' WHERE id = $1 AND status = 'sending'`,
        [id]
      );
      return true;
    },

    async cancel(p) {
      const result = await query(
        `
        UPDATE zalo_announcements SET status = 'cancelled'
        WHERE ${ownsDraft} AND status = 'draft' RETURNING id
      `,
        identity(p)
      );
      return result.rowCount === 1;
    },

    async status(p) {
      const result = await query(
        `
        SELECT a.id, a.status,
          COUNT(d.chat_id)::INTEGER AS total,
          COUNT(*) FILTER (WHERE d.status = 'sent')::INTEGER AS sent,
          COUNT(*) FILTER (WHERE d.status = 'failed')::INTEGER AS failed,
          COUNT(*) FILTER (WHERE d.status IN ('unknown', 'sending'))::INTEGER AS uncertain,
          COUNT(*) FILTER (WHERE d.status = 'pending')::INTEGER AS pending,
          COUNT(*) FILTER (WHERE d.status = 'skipped')::INTEGER AS skipped
        FROM zalo_announcements a
        LEFT JOIN zalo_announcement_deliveries d ON d.announcement_id = a.id
        WHERE a.id = $1 AND a.actor_id = $2 AND a.source_chat_id = $3 AND a.source_thread_id = $4
        GROUP BY a.id
      `,
        identity(p)
      );
      return result.rows[0] || null;
    },
  });
}

module.exports = {
  ensureZaloAnnouncementTables,
  createZaloAnnouncementRepository,
};
