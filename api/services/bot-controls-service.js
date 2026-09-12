const { Pool } = require('pg');

const PLATFORMS = ['telegram', 'zalo'];
const MODES = ['polling', 'webhook'];

function isPlatform(value) {
  return PLATFORMS.includes(value);
}

function safeRow(row, platform) {
  return {
    platform,
    commandsEnabled: row ? row.commands_enabled !== false : true,
    lastCommandAt: row?.last_command_at ?? null,
    mode: row?.mode ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function createBotControlsService({ db, clock = () => new Date() } = {}) {
  // An injected database is used by tests. Production must have DATABASE_URL.
  const injectedDb = Boolean(db);
  if (!db && process.env.DATABASE_URL) {
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      statement_timeout: 2000,
      query_timeout: 3000,
      connectionTimeoutMillis: 1000,
    });
  }
  const configured = injectedDb || Boolean(process.env.DATABASE_URL);
  let tablePromise;

  function query(text, values) {
    return db.query(text, values);
  }

  function ensureConfigured() {
    if (!configured || !db || typeof db.query !== 'function') {
      const error = new Error('DATABASE_NOT_CONFIGURED');
      error.code = 'DATABASE_NOT_CONFIGURED';
      throw error;
    }
  }

  async function ensureTable() {
    ensureConfigured();
    if (!tablePromise) {
      tablePromise = (async () => {
          if (typeof db.connect !== 'function') {
            const error = new Error('DATABASE_NOT_CONFIGURED');
            error.code = 'DATABASE_NOT_CONFIGURED';
            throw error;
          }
            const client = await db.connect();
            try {
              await client.query('BEGIN');
              await client.query(`
        CREATE TABLE IF NOT EXISTS bot_controls (
          platform TEXT PRIMARY KEY CHECK (platform IN ('telegram', 'zalo')),
          commands_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          last_command_at TIMESTAMPTZ NULL,
          mode TEXT NULL CHECK (mode IN ('polling', 'webhook')),
          updated_at TIMESTAMPTZ NULL
        )
      `);
              await client.query('ALTER TABLE bot_controls ENABLE ROW LEVEL SECURITY');
              await client.query(`
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                    EXECUTE 'REVOKE ALL ON TABLE bot_controls FROM anon';
                  END IF;
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                    EXECUTE 'REVOKE ALL ON TABLE bot_controls FROM authenticated';
                  END IF;
                  EXECUTE 'REVOKE ALL ON TABLE bot_controls FROM PUBLIC';
                END $$;
              `);
              await client.query('COMMIT');
            } catch (error) {
              await client.query('ROLLBACK').catch(() => {});
              throw error;
            } finally {
              client.release();
            }
          })().catch(error => {
        tablePromise = null;
        throw error;
      });
    }
    await tablePromise;
  }

  async function list() {
    await ensureTable();
    const result = await query(
      `SELECT platform, commands_enabled, last_command_at, mode, updated_at
         FROM bot_controls
        WHERE platform IN ('telegram', 'zalo')`
    );
    const rows = new Map((result.rows || []).map(row => [row.platform, row]));
    return PLATFORMS.map(platform => safeRow(rows.get(platform), platform));
  }

  async function save(platform, commandsEnabled) {
    if (!isPlatform(platform) || typeof commandsEnabled !== 'boolean') {
      return { ok: false, code: 'INVALID_REQUEST' };
    }
    await ensureTable();
    const updatedAt = clock();
    const result = await query(
      `INSERT INTO bot_controls (platform, commands_enabled, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (platform) DO UPDATE SET
         commands_enabled = EXCLUDED.commands_enabled,
         updated_at = EXCLUDED.updated_at
       RETURNING platform, commands_enabled, last_command_at, mode, updated_at`,
      [platform, commandsEnabled, updatedAt]
    );
    if (!result.rows?.[0]) {
      const error = new Error('DATABASE_WRITE_FAILED');
      error.code = 'DATABASE_WRITE_FAILED';
      throw error;
    }
    return { ok: true, control: safeRow(result.rows[0], platform) };
  }

  async function check(platform, mode) {
    if (!isPlatform(platform) || !MODES.includes(mode)) {
      return { ok: false, code: 'INVALID_REQUEST' };
    }
    await ensureTable();
    const result = await query(
      `INSERT INTO bot_controls
         (platform, commands_enabled, last_command_at, mode, updated_at)
       VALUES ($1, TRUE, $2, $3, NULL)
       ON CONFLICT (platform) DO UPDATE SET
         last_command_at = EXCLUDED.last_command_at,
         mode = EXCLUDED.mode
       RETURNING platform, commands_enabled, last_command_at, mode, updated_at`,
      [platform, clock(), mode]
    );
    if (!result.rows?.[0]) {
      const error = new Error('DATABASE_WRITE_FAILED');
      error.code = 'DATABASE_WRITE_FAILED';
      throw error;
    }
    const control = safeRow(result.rows[0], platform);
    return { ok: true, allowed: control.commandsEnabled, control };
  }

  return { list, save, check };
}

module.exports = {
  MODES,
  PLATFORMS,
  createBotControlsService,
};
