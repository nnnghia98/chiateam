const crypto = require('node:crypto');
const { Pool } = require('pg');
const { getEntry, getCatalog } = require('./catalog');
const { safeDestination } = require('./destinations');
const { COMMAND_MANIFEST } = require('../../core/commands/command-manifest');
const {
  ZALO_COMMAND_MANIFEST,
} = require('../../runtime/create-zalo-command-definitions');
function seal(value, key, aad) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  return {
    iv: iv.toString('base64'),
    data: Buffer.concat([
      cipher.update(String(value), 'utf8'),
      cipher.final(),
    ]).toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}
function open(value, key, aad) {
  const cipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(value.iv, 'base64')
  );
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    cipher.update(Buffer.from(value.data, 'base64')),
    cipher.final(),
  ]).toString('utf8');
}
const record = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function createManagementStore({
  env = process.env,
  db,
  clock = () => new Date(),
} = {}) {
  const key = Buffer.from(env.MANAGEMENT_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32)
    throw Object.assign(new Error('MANAGEMENT_ENCRYPTION_KEY_REQUIRED'), {
      code: 'MANAGEMENT_ENCRYPTION_KEY_REQUIRED',
      status: 503,
    });
  const pool =
    db ||
    (env.MANAGEMENT_DATABASE_URL || env.DATABASE_URL
      ? new Pool({
          ...require('../db/managed-connection').managedConnectionOptions(
            env.MANAGEMENT_DATABASE_URL || env.DATABASE_URL,
            env
          ),
          max: 4,
          statement_timeout: 5000,
          query_timeout: 6000,
          connectionTimeoutMillis: 3000,
        })
      : null);
  let schemaReady = false;
  function initial() {
    const state = {
      version: 0,
      activeVersion: 0,
      previousActiveVersion: null,
      values: {},
      secrets: {},
      versions: {},
      services: {},
      audit: [],
      checks: {},
    };
    for (const item of getCatalog()) {
      const value = env[item.key] ?? item.default;
      if (value === undefined) continue;
      if (item.secret) {
        if (value)
          state.secrets[item.key] = {
            configured: true,
            source: 'environment',
            encryptionVersion: 0,
            ciphertext: seal(value, key, `${item.key}:0`),
          };
      } else
        state.values[item.key] =
          item.type === 'boolean'
            ? String(value) === 'true'
            : item.type === 'number'
              ? Number(value)
              : item.type === 'json'
                ? typeof value === 'string'
                  ? JSON.parse(value)
                  : value
                : value;
    }
    if (!state.values.API_PORT)
      state.values.API_PORT = Number(
        env.API_PORT || env.UI_API_PORT || env.PORT || 8787
      );
    const fallback =
      env.API_INTERNAL_URL ||
      env.BOT_API_BASE_URL ||
      env.API_BASE_URL ||
      env.API_URL;
    for (const name of ['ADMIN_API_URL', 'TELEGRAM_API_URL', 'ZALO_API_URL'])
      if (!state.values[name] && fallback) state.values[name] = fallback;
    state.versions[0] = {
      version: 0,
      values: clone(state.values),
      secrets: clone(state.secrets),
    };
    return state;
  }
  async function transaction(mutator) {
    if (!pool?.connect)
      throw Object.assign(new Error('MANAGEMENT_DATABASE_UNAVAILABLE'), {
        code: 'MANAGEMENT_DATABASE_UNAVAILABLE',
        status: 503,
      });
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      await connection.query('SELECT pg_advisory_xact_lock(182731, 1)');
      if (!schemaReady) {
        await connection.query(
          'CREATE TABLE IF NOT EXISTS management_snapshots (id integer PRIMARY KEY, version integer NOT NULL, active_version integer NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())'
        );
        schemaReady = true;
      }
      const response = await connection.query(
        'SELECT version, active_version, payload FROM management_snapshots WHERE id=1 FOR UPDATE'
      );
      const row = response.rows[0];
      const state = row
        ? {
            ...clone(
              typeof row.payload === 'string'
                ? JSON.parse(row.payload)
                : row.payload
            ),
            version: Number(row.version),
            activeVersion: Number(row.active_version),
          }
        : initial();
      const result = await mutator(state);
      if (result?.write !== false || !row)
        await connection.query(
          'INSERT INTO management_snapshots (id,version,active_version,payload) VALUES (1,$1,$2,$3) ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,active_version=EXCLUDED.active_version,payload=EXCLUDED.payload,updated_at=now()',
          [state.version, state.activeVersion, JSON.stringify(state)]
        );
      await connection.query('COMMIT');
      return result?.value === undefined ? clone(state) : result.value;
    } catch (error) {
      schemaReady = false;
      await connection.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }
  // A separate session lock drains management writes without blocking runtime
  // heartbeat transactions on the settings row.
  async function exclusiveOperation(action) {
    const connection = await pool.connect();
    try {
      await connection.query('SELECT pg_advisory_lock(182731, 2)');
      return await action();
    } finally {
      await connection
        .query('SELECT pg_advisory_unlock(182731, 2)')
        .catch(() => {});
      connection.release();
    }
  }
  const snapshot = () =>
    transaction(state => ({ write: false, value: clone(state) }));
  function normalized(changes = {}, secrets = {}) {
    if (!record(changes) || !record(secrets)) return null;
    const values = { ...changes },
      secretActions = { ...secrets };
    for (const [name, value] of Object.entries(values))
      if (getEntry(name)?.secret) {
        secretActions[name] = value;
        delete values[name];
      }
    return { values, secrets: secretActions };
  }
  function validateChanges(changes = {}, secrets = {}) {
    const input = normalized(changes, secrets);
    if (!input) return 'INVALID_PAYLOAD';
    for (const [name, value] of Object.entries(input.values)) {
      const item = getEntry(name);
      if (!item) return 'UNKNOWN_SETTING';
      if (item.secret) return 'INVALID_SECRET_ACTION';
      if (
        ['text', 'url'].includes(item.type) &&
        (typeof value !== 'string' || value.length > 4000)
      )
        return 'INVALID_VALUE';
      if (item.type === 'boolean' && typeof value !== 'boolean')
        return 'INVALID_VALUE';
      if (
        item.type === 'number' &&
        (!Number.isInteger(value) || value < 1 || value > 65535)
      )
        return 'INVALID_VALUE';
      if (item.type === 'enum' && !item.options.includes(value))
        return 'INVALID_VALUE';
      if (item.type === 'url' && value) {
        try {
          const url = new URL(value);
          if (
            [
              'ADMIN_API_URL',
              'TELEGRAM_API_URL',
              'ZALO_API_URL',
              'BOT_API_BASE_URL',
              'API_INTERNAL_URL',
              'API_BASE_URL',
              'API_URL',
            ].includes(name) &&
            !['/', '/api', '/api/'].includes(url.pathname)
          )
            return 'INVALID_API_PATH';
          if (
            !['https:', 'http:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
          )
            return 'INVALID_URL';
        } catch {
          return 'INVALID_URL';
        }
      }
      if (
        [
          'ADMIN_API_URL',
          'TELEGRAM_API_URL',
          'ZALO_API_URL',
          'BOT_API_BASE_URL',
          'API_INTERNAL_URL',
          'API_BASE_URL',
          'API_URL',
          'SUPABASE_URL',
        ].includes(name) &&
        value
      ) {
        try {
          safeDestination(value, env);
        } catch {
          return 'DESTINATION_NOT_ALLOWED';
        }
      }
      if (item.type === 'json') {
        if (!record(value) || JSON.stringify(value).length > 24000)
          return 'INVALID_COMMAND_RULES';
        const commands =
          name === 'TELEGRAM_COMMAND_RULES'
            ? COMMAND_MANIFEST
            : ZALO_COMMAND_MANIFEST;
        for (const [command, rule] of Object.entries(value)) {
          const definition = commands.find(entry => entry.name === command);
          if (
            !definition ||
            !record(rule) ||
            Object.keys(rule).some(
              k => !['enabled', 'permission'].includes(k)
            ) ||
            ('enabled' in rule && typeof rule.enabled !== 'boolean') ||
            ('permission' in rule &&
              !['player', 'admin'].includes(rule.permission))
          )
            return 'INVALID_COMMAND_RULES';
          if (definition.permission === 'admin' && rule.permission === 'player')
            return 'PERMISSION_DOWNGRADE';
          if (
            name === 'ZALO_COMMAND_RULES' &&
            command === 'unsubscribe' &&
            (rule.enabled === false || rule.permission === 'admin')
          )
            return 'UNSUBSCRIBE_REQUIRED';
        }
      }
    }
    for (const [name, action] of Object.entries(input.secrets)) {
      const item = getEntry(name);
      if (!item) return 'UNKNOWN_SETTING';
      if (!item.secret) return 'NON_SECRET_SECRET_ACTION';
      if (
        !record(action) ||
        !['keep', 'replace', 'remove'].includes(action.action) ||
        Object.keys(action).some(k => !['action', 'value'].includes(k))
      )
        return 'INVALID_SECRET_ACTION';
      if (action.action !== 'replace' && 'value' in action)
        return 'INVALID_SECRET_ACTION';
      if (action.action === 'replace') {
        if (
          typeof action.value !== 'string' ||
          !action.value.trim() ||
          action.value.length > 8192
        )
          return 'INVALID_SECRET_ACTION';
        if (name === 'DATABASE_URL') {
          try {
            const url = new URL(action.value);
            const trusted =
              env.MANAGEMENT_ALLOWED_DATABASE_HOSTS ||
              [env.DATABASE_URL, env.MANAGEMENT_DATABASE_URL]
                .filter(Boolean)
                .map(value => new URL(value).hostname)
                .join(',');
            if (
              !['postgres:', 'postgresql:'].includes(url.protocol) ||
              !String(trusted)
                .split(',')
                .map(x => x.trim())
                .includes(url.hostname)
            )
              return 'DATABASE_HOST_NOT_ALLOWED';
          } catch {
            return 'DATABASE_HOST_NOT_ALLOWED';
          }
        }
      }
    }
    return null;
  }
  async function save({
    expectedVersion,
    changes = {},
    secrets = {},
    actor = 'unknown',
  } = {}) {
    const bad = validateChanges(changes, secrets);
    if (bad) return { ok: false, code: bad };
    const input = normalized(changes, secrets);
    return transaction(state => {
      if (
        !Number.isInteger(expectedVersion) ||
        expectedVersion !== state.version
      )
        return {
          write: false,
          value: { ok: false, code: 'STALE_VERSION', status: 409 },
        };
      const version = state.version + 1;
      Object.assign(state.values, input.values);
      for (const [name, action] of Object.entries(input.secrets)) {
        if (action.action === 'keep') continue;
        state.secrets[name] =
          action.action === 'remove'
            ? {
                configured: false,
                source: 'removed',
                tombstone: true,
                encryptionVersion: version,
              }
            : {
                configured: true,
                source: 'managed',
                encryptionVersion: version,
                ciphertext: seal(action.value, key, `${name}:${version}`),
              };
      }
      state.version = version;
      state.versions[version] = {
        version,
        values: clone(state.values),
        secrets: clone(state.secrets),
      };
      state.audit.push({
        version,
        action: 'save',
        actor: String(actor).slice(0, 200),
        keys: [...Object.keys(input.values), ...Object.keys(input.secrets)],
        at: clock().toISOString(),
      });
      return { value: { ok: true, snapshot: clone(state) } };
    });
  }
  async function resolveVersion(version, service) {
    const state = await snapshot(),
      selected = state.versions[version];
    if (!selected) return { ok: false, code: 'VERSION_NOT_FOUND' };
    const output = {};
    for (const item of getCatalog())
      if (item.services.includes(service)) {
        if (item.secret) {
          const saved = selected.secrets[item.key];
          output[item.key] = saved?.configured
            ? open(
                saved.ciphertext,
                key,
                `${item.key}:${saved.encryptionVersion}`
              )
            : '';
        } else {
          const value = selected.values[item.key];
          output[item.key] =
            value == null
              ? ''
              : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
        }
      }
    return { ok: true, version, env: output };
  }
  async function activate(expectedVersion, action, actor) {
    return transaction(state => {
      if (
        !Number.isInteger(expectedVersion) ||
        expectedVersion !== state.version
      )
        return {
          write: false,
          value: { ok: false, code: 'STALE_VERSION', status: 409 },
        };
      const target =
        action === 'rollback' ? state.previousActiveVersion : state.version;
      if (!Number.isInteger(target) || !state.versions[target])
        return {
          write: false,
          value: { ok: false, code: 'NO_PREVIOUS_VERSION' },
        };
      if (state.storageTransition)
        state.storageTransition = {
          ...state.storageTransition,
          phase: 'starting',
          target,
        };
      if (target !== state.activeVersion) {
        state.previousActiveVersion = state.activeVersion;
        state.activeVersion = target;
      }
      for (const service of [
        'api',
        'telegram',
        'zalo-polling',
        'zalo-webhook',
        'admin',
      ])
        state.services[service] = {
          ...(state.services[service] || {}),
          desiredVersion: target,
          desiredState: 'running',
          state: 'pending',
        };
      state.audit.push({
        version: state.version,
        action,
        actor: String(actor || 'unknown').slice(0, 200),
        keys: [],
        at: clock().toISOString(),
      });
      return { value: { ok: true, snapshot: clone(state) } };
    });
  }
  return {
    transaction,
    exclusiveOperation,
    snapshot,
    readDraft: snapshot,
    readActive: async () => {
      const s = await snapshot();
      return s.versions[s.activeVersion];
    },
    resolveVersion,
    resolveActive: async service =>
      resolveVersion((await snapshot()).activeVersion, service),
    resolveDraft: async service =>
      resolveVersion((await snapshot()).version, service),
    validateChanges,
    save,
    apply: (version, actor) => activate(version, 'apply', actor),
    rollback: (version, actor) => activate(version, 'rollback', actor),
    close: async () => {
      if (!db) await pool?.end();
    },
  };
}
module.exports = { createManagementStore, seal, open };
