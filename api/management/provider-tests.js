const { fixedProviderUrl, safeDestination } = require('./destinations');
const { Pool } = require('pg');

const text = value => String(value ?? '').trim();
function candidate(env, changes, key) {
  const secret = changes?.secrets?.[key] || changes?.[key];
  if (secret && typeof secret === 'object') {
    if (secret.action === 'remove') return '';
    if (
      secret.action === 'replace' ||
      Object.prototype.hasOwnProperty.call(secret, 'value')
    )
      return text(secret.value);
    if (secret.action === 'keep') return text(env[key]);
  }
  if (Object.prototype.hasOwnProperty.call(changes || {}, key))
    return text(changes[key]);
  return text(env[key]);
}
const resultIdentity = (target, data) => {
  const source = data?.result || data;
  if (!source || typeof source !== 'object') return undefined;
  if (target === 'telegram')
    return {
      id: source.id,
      account_name: source.username || source.first_name,
    };
  if (target === 'zalo')
    return {
      id: source.id,
      account_name:
        source.account_name ||
        source.username ||
        source.display_name ||
        source.name,
    };
  return undefined;
};

async function callJson(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, {
          ...options,
          redirect: 'error',
          signal: controller.signal,
        });
        const body = await response.json();
        if (response.redirected || !response.ok || body?.ok === false)
          throw new Error('PROVIDER_CHECK_FAILED');
        return body;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('TIMEOUT'));
        }, 5000);
      }),
    ]);
  } catch (error) {
    throw new Error(
      ['TIMEOUT', 'PROVIDER_CHECK_FAILED'].includes(error.message)
        ? error.message
        : 'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timer);
  }
}

async function testConnections(
  target,
  {
    env = process.env,
    changes = {},
    fetchImpl = globalThis.fetch,
    providers = {},
  } = {}
) {
  const candidateEnv = {
    ...env,
    ...Object.fromEntries(
      Object.entries(changes || {}).filter(
        ([key]) => !/TOKEN|SECRET|KEY|PASSWORD/i.test(key)
      )
    ),
  };
  const checkedAt = new Date().toISOString();
  try {
    if (typeof providers[target] === 'function') {
      const value = await providers[target]({ env, fetchImpl });
      return { ok: true, target, checkedAt, ...(value || {}) };
    }
    if (typeof fetchImpl !== 'function') throw new Error('NETWORK_ERROR');
    if (target === 'telegram' || target === 'zalo') {
      const tokenKey =
        target === 'telegram' ? 'TELEGRAM_BOT_TOKEN' : 'ZALO_BOT_TOKEN';
      const token = candidate(env, changes, tokenKey);
      if (!token) throw new Error('MISSING_PROVIDER_TOKEN');
      const base = target === 'telegram' ? 'getMe' : 'getMe';
      const providerOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      };
      const identity = resultIdentity(
        target,
        await callJson(
          fetchImpl,
          fixedProviderUrl(target, token, base),
          providerOptions
        )
      );
      const webhook = await callJson(
        fetchImpl,
        fixedProviderUrl(target, token, 'getWebhookInfo'),
        providerOptions
      );
      return {
        ok: true,
        target,
        checkedAt,
        identity,
        mode:
          target === 'zalo'
            ? webhook.result?.url
              ? 'webhook'
              : 'polling'
            : 'polling',
        webhook: { configured: Boolean(webhook.result?.url) },
      };
    }
    if (target === 'api') {
      const origin = safeDestination(
        candidateEnv.ADMIN_API_URL ||
          candidateEnv.MANAGEMENT_API_URL ||
          candidateEnv.API_INTERNAL_URL ||
          candidateEnv.BOT_API_BASE_URL,
        candidateEnv
      );
      const auth = candidate(env, changes, 'INTERNAL_API_AUTH_TOKEN');
      if (!auth) throw new Error('MISSING_CREDENTIAL');
      const body = await callJson(
        fetchImpl,
        `${origin.replace(/\/api$/, '')}/api/bot-controls`,
        {
          method: 'GET',
          headers: { 'x-internal-api-auth': auth, 'x-admin-role': 'admin' },
        }
      );
      return {
        ok: true,
        target,
        checkedAt,
        details: { healthy: body?.ok !== false },
      };
    }
    if (target === 'database') {
      if (typeof providers.database === 'function')
        return {
          ok: true,
          target,
          checkedAt,
          ...(await providers.database({ env, changes })),
        };
      const connectionString = candidate(env, changes, 'DATABASE_URL');
      const host = (() => {
        try {
          return new URL(connectionString).hostname;
        } catch {
          return '';
        }
      })();
      const allowed = text(
        env.MANAGEMENT_ALLOWED_DATABASE_HOSTS || env.MANAGEMENT_DATABASE_HOST
      )
        .split(',')
        .map(text)
        .filter(Boolean);
      if (!connectionString || !host || !allowed.includes(host))
        throw new Error('DATABASE_HOST_NOT_ALLOWED');
      const makePool = providers.createPool || providers.poolFactory;
      const pool = await (typeof makePool === 'function'
        ? makePool({
            ...require('../db/managed-connection').managedConnectionOptions(
              connectionString,
              env
            ),
            max: 1,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 5000,
          })
        : new Pool({
            ...require('../db/managed-connection').managedConnectionOptions(
              connectionString,
              env
            ),
            max: 1,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 5000,
          }));
      try {
        await pool.query('SELECT 1');
        const tables = await pool.query(
          "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('storage', 'current_match', 'players', 'zalo_announcement_subscriptions', 'zalo_announcements', 'zalo_announcement_deliveries')"
        );
        const names = tables.rows.map(row => row.name);
        const required = [
          'storage',
          'current_match',
          'players',
          'zalo_announcement_subscriptions',
          'zalo_announcements',
          'zalo_announcement_deliveries',
        ];
        if (required.some(name => !names.includes(name)))
          throw new Error('DATABASE_SCHEMA_INCOMPLETE');
        return { ok: true, target, checkedAt, details: { tables: names } };
      } finally {
        if (typeof pool.end === 'function') await pool.end();
      }
    }
    if (target === 'supabase') {
      const origin = safeDestination(candidateEnv.SUPABASE_URL, candidateEnv);
      const key = candidate(env, changes, 'SUPABASE_SERVICE_ROLE_KEY');
      if (!key) throw new Error('MISSING_CREDENTIAL');
      await callJson(fetchImpl, `${origin}/storage/v1/bucket`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      return { ok: true, target, checkedAt };
    }
    if (target === 'gemini') {
      const key = candidate(env, changes, 'GEMINI_API_KEY');
      if (!key) throw new Error('MISSING_CREDENTIAL');
      await callJson(
        fetchImpl,
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': key } }
      );
      return { ok: true, target, checkedAt };
    }
    throw new Error('UNKNOWN_TARGET');
  } catch (error) {
    const known = new Set([
      'DESTINATION_NOT_ALLOWED',
      'UNKNOWN_PROVIDER',
      'MISSING_PROVIDER_TOKEN',
      'MISSING_CREDENTIAL',
      'NETWORK_ERROR',
      'PROVIDER_CHECK_FAILED',
      'DATABASE_PROVIDER_REQUIRED',
      'DATABASE_HOST_NOT_ALLOWED',
      'DATABASE_SCHEMA_INCOMPLETE',
      'TIMEOUT',
      'UNKNOWN_TARGET',
    ]);
    const errorCode = known.has(error.message)
      ? error.message
      : error.name === 'TypeError'
        ? 'INVALID_CONFIGURATION'
        : 'CHECK_FAILED';
    return { ok: false, target, checkedAt, errorCode };
  }
}

module.exports = { testConnections };
