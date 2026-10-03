const { createManagementStore } = require('./store');
const { getCatalog, getEntry, BOOTSTRAP } = require('./catalog');
const { COMMAND_MANIFEST } = require('../../core/commands/command-manifest');
const {
  ZALO_COMMAND_MANIFEST,
} = require('../../runtime/create-zalo-command-definitions');
const { testConnections } = require('./provider-tests');
const { runManagementOperation, ACTIONS } = require('./operations');
const {
  createZaloAnnouncementRepository,
} = require('../routes/zalo-announcements');
const SERVICES = ['api', 'telegram', 'zalo-polling', 'zalo-webhook', 'admin'];
const STATE = new Set([
  'pending',
  'applied',
  'failed',
  'stopped',
  'deployment_required',
]);
const SOURCE_SERVICE = {
  telegram: 'telegram',
  zalo: 'zalo-webhook',
  api: 'admin',
  database: 'api',
  supabase: 'api',
  gemini: 'api',
};
const CONNECTION_KEYS = [
  'ADMIN_API_URL',
  'TELEGRAM_API_URL',
  'ZALO_API_URL',
  'BOT_API_BASE_URL',
  'API_INTERNAL_URL',
  'API_BASE_URL',
  'API_URL',
];
const DEPLOYMENT_KEYS = ['API_PORT', 'PORT', 'UI_API_PORT'];
function failure(code, status = 400) {
  return { ok: false, code, status };
}
function changedKeys(draft, active) {
  return getCatalog()
    .filter(
      item =>
        JSON.stringify(
          item.secret ? draft.secrets[item.key] : draft.values[item.key]
        ) !==
        JSON.stringify(
          item.secret ? active.secrets?.[item.key] : active.values?.[item.key]
        )
    )
    .map(item => item.key);
}
function safeCheck(value) {
  const out = {};
  for (const key of ['ok', 'target', 'checkedAt', 'mode', 'errorCode'])
    if (['string', 'boolean'].includes(typeof value?.[key]))
      out[key] = value[key];
  if (value?.identity) {
    out.identity = {};
    for (const key of ['id', 'username', 'account_name', 'first_name', 'name'])
      if (['string', 'number'].includes(typeof value.identity[key]))
        out.identity[key] = value.identity[key];
  }
  return out;
}
function createManagementService({
  env = process.env,
  db,
  clock = () => new Date(),
  fetchImpl = globalThis.fetch,
  testImpl = testConnections,
  operationImpl = runManagementOperation,
  quiesce: quiesceImpl,
  poolFactory,
} = {}) {
  const store = createManagementStore({ env, db, clock });
  const now = () => clock().getTime();
  function plan(s) {
    const active = s.versions[s.activeVersion] || {};
    const keys = changedKeys(s, active);
    return {
      version: s.version,
      activeVersion: s.activeVersion,
      platform: 'railway',
      deploymentRequired: keys.some(k => DEPLOYMENT_KEYS.includes(k)),
      requirements: keys
        .filter(k => DEPLOYMENT_KEYS.includes(k))
        .map(key => ({
          service: getEntry(key).services.join(', '),
          steps: [
            `Configure Railway ${key} to match the saved value, then confirm hosting setup before Apply.`,
          ],
        })),
    };
  }
  function safe(s) {
    return {
      version: s.version,
      activeVersion: s.activeVersion,
      previousVersion: s.previousActiveVersion,
      catalog: getCatalog(),
      values: s.values,
      secrets: Object.fromEntries(
        getCatalog()
          .filter(e => e.secret)
          .map(e => [
            e.key,
            {
              configured: Boolean(s.secrets[e.key]?.configured),
              source: s.secrets[e.key]?.source || 'unset',
            },
          ])
      ),
      services: SERVICES.map(id => ({
        id,
        desiredVersion: s.activeVersion,
        appliedVersion: null,
        state: 'pending',
        ...(s.services[id] || {}),
      })),
      audit: (s.audit || []).map(({ version, action, actor, keys, at }) => ({
        version,
        action,
        actor,
        keys,
        at,
      })),
      checks: Object.fromEntries(
        Object.entries(s.checks || {}).map(([key, value]) => [
          key,
          safeCheck(value),
        ])
      ),
      commands: { telegram: COMMAND_MANIFEST, zalo: ZALO_COMMAND_MANIFEST },
      bootstrap: BOOTSTRAP.map(item => ({
        ...item,
        configured: Boolean(env[item.key]),
      })),
      applyPlan: plan(s),
    };
  }
  async function snapshot() {
    return safe(await store.snapshot());
  }
  async function resolved(version, services = SERVICES) {
    const output = { ...env };
    for (const service of services) {
      const value = await store.resolveVersion(version, service);
      if (!value.ok) throw new Error('VERSION_NOT_FOUND');
      Object.assign(output, value.env);
    }
    return output;
  }
  async function runtime(service) {
    if (!SERVICES.includes(service)) return failure('INVALID_SERVICE');
    const s = await store.snapshot(),
      value = await store.resolveVersion(s.activeVersion, service),
      state = s.services[service] || {};
    const lease = s.services['zalo-polling:lease'];
    return {
      version: s.activeVersion,
      env: value.env,
      restartGeneration: state.restartGeneration || 0,
      desiredState: state.desiredState || 'running',
      receiverBlocked:
        service === 'zalo-webhook' && Boolean(lease && lease.expiresAt > now()),
    };
  }
  async function report(service, payload = {}) {
    if (
      !SERVICES.includes(service) ||
      !Number.isInteger(payload.version) ||
      !STATE.has(payload.state)
    )
      return failure('INVALID_REPORT');
    if (
      payload.instanceId !== undefined &&
      (typeof payload.instanceId !== 'string' ||
        payload.instanceId.length > 128)
    )
      return failure('INVALID_REPORT');
    return store.transaction(s => {
      if (payload.version !== s.activeVersion)
        return { write: false, value: failure('STALE_REPORT', 409) };
      const prior = s.services[service] || {};
      s.services[service] = {
        ...prior,
        desiredVersion: s.activeVersion,
        appliedVersion:
          payload.state === 'applied'
            ? payload.version
            : (prior.appliedVersion ?? null),
        state: payload.state,
        lastSeenAt: clock().toISOString(),
        instanceId: payload.instanceId || null,
        healthy: payload.state === 'applied' && payload.healthy !== false,
        errorCode: /^[A-Z_]{1,64}$/.test(payload.errorCode || '')
          ? payload.errorCode
          : null,
      };
      if (
        service === 'api' &&
        (payload.state === 'applied' ||
          (payload.state === 'stopped' &&
            !s.versions[payload.version]?.secrets.DATABASE_URL?.configured)) &&
        s.storageTransition?.phase === 'starting' &&
        s.storageTransition.target === payload.version
      )
        delete s.storageTransition;
      return { value: { ok: true } };
    });
  }
  async function lease(service, payload = {}) {
    if (
      !['api', 'telegram', 'zalo-polling', 'zalo-webhook'].includes(service) ||
      typeof payload.instanceId !== 'string' ||
      !payload.instanceId ||
      payload.instanceId.length > 128 ||
      !['acquire', 'renew', 'release'].includes(payload.action)
    )
      return failure('INVALID_LEASE');
    return store.transaction(s => {
      const key = `${service}:lease`,
        current = s.services[key],
        owner = payload.instanceId;
      if (payload.action === 'release') {
        if (current?.instanceId !== owner)
          return {
            write: false,
            value: { granted: false, code: 'LEASE_OWNER_MISMATCH' },
          };
        delete s.services[key];
        return { value: { granted: true, expiresAt: null } };
      }
      if (
        payload.action === 'renew' &&
        (!current || current.instanceId !== owner || current.expiresAt <= now())
      )
        return {
          write: false,
          value: { granted: false, code: 'LEASE_OWNER_MISMATCH' },
        };
      const mode = s.versions[s.activeVersion]?.values.ZALO_MODE || 'polling';
      if (payload.action === 'acquire') {
        if (
          s.services[service]?.desiredState === 'stopped' ||
          (service === 'zalo-polling' && mode !== 'polling') ||
          (service === 'zalo-webhook' && mode !== 'webhook')
        )
          return {
            write: false,
            value: { granted: false, code: 'MODE_CONFLICT' },
          };
        const other =
          s.services[
            `${service === 'zalo-polling' ? 'zalo-webhook' : 'zalo-polling'}:lease`
          ];
        if (service.startsWith('zalo') && other?.expiresAt > now())
          return {
            write: false,
            value: { granted: false, code: 'LEASE_CONFLICT' },
          };
      }
      if (current?.expiresAt > now() && current.instanceId !== owner)
        return {
          write: false,
          value: {
            granted: false,
            expiresAt: new Date(current.expiresAt).toISOString(),
          },
        };
      const expiresAt = now() + 30000;
      s.services[key] = { instanceId: owner, expiresAt };
      return {
        value: { granted: true, expiresAt: new Date(expiresAt).toISOString() },
      };
    });
  }
  function normalizeChanges(body) {
    return { ...(body.changes || {}), ...(body.secrets || {}) };
  }
  function candidate(base, changes) {
    const next = { ...base };
    for (const [key, value] of Object.entries(changes)) {
      if (getEntry(key)?.secret) {
        if (value.action === 'replace') next[key] = value.value;
        else if (value.action === 'remove') next[key] = '';
      } else
        next[key] =
          typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    return next;
  }
  async function checked(target, candidateEnv) {
    return safeCheck(
      await testImpl(target, { env: candidateEnv, changes: {}, fetchImpl })
    );
  }
  async function test(body = {}) {
    if (!SOURCE_SERVICE[body.target]) return failure('UNKNOWN_TARGET');
    const s = await store.snapshot();
    if (body.expectedVersion !== s.version)
      return failure('STALE_VERSION', 409);
    const changes = normalizeChanges(body),
      bad = store.validateChanges?.(changes);
    if (bad) return failure(bad);
    const next = candidate(await resolved(s.version), changes);
    const result = await checked(body.target, next);
    await store.transaction(current => {
      if (current.version !== s.version) return { write: false, value: null };
      current.checks[body.target] = result;
      return { value: null };
    });
    return result;
  }
  function targetsFor(keys) {
    const targets = new Set();
    for (const key of keys) {
      if (key === 'TELEGRAM_BOT_TOKEN') targets.add('telegram');
      if (
        [
          'ZALO_BOT_TOKEN',
          'ZALO_WEBHOOK_SECRET',
          'ZALO_WEBHOOK_URL',
          'ZALO_MODE',
        ].includes(key)
      )
        targets.add('zalo');
      if (key === 'DATABASE_URL') targets.add('database');
      if (key.startsWith('SUPABASE_')) targets.add('supabase');
      if (key === 'GEMINI_API_KEY') targets.add('gemini');
      if (key === 'INTERNAL_API_AUTH_TOKEN' || CONNECTION_KEYS.includes(key))
        targets.add('api');
    }
    return targets;
  }
  async function validateCandidates(keys, next, old) {
    for (const target of targetsFor(keys)) {
      const tokenKey = {
        telegram: 'TELEGRAM_BOT_TOKEN',
        zalo: 'ZALO_BOT_TOKEN',
        gemini: 'GEMINI_API_KEY',
        supabase: 'SUPABASE_SERVICE_ROLE_KEY',
        database: 'DATABASE_URL',
      }[target];
      if (tokenKey && !next[tokenKey]) continue; // Explicit removal stops/disables the dependent service.
      if (target === 'api') {
        const urls = [
          ...new Set(
            ['ADMIN_API_URL', 'TELEGRAM_API_URL', 'ZALO_API_URL']
              .map(k => next[k])
              .filter(Boolean)
          ),
        ];
        if (!next.INTERNAL_API_AUTH_TOKEN) continue;
        for (const url of urls) {
          const probe = { ...next, ADMIN_API_URL: url };
          let result = await checked('api', probe);
          // Same endpoint token rotation is staged: prove the old connection first;
          // new credentials are acknowledged only after the API child is ready.
          if (
            !result.ok &&
            keys.includes('INTERNAL_API_AUTH_TOKEN') &&
            !keys.some(k => CONNECTION_KEYS.includes(k))
          ) {
            result = await checked('api', {
              ...probe,
              INTERNAL_API_AUTH_TOKEN: old.INTERNAL_API_AUTH_TOKEN,
            });
          }
          if (!result.ok)
            return {
              ...failure('CANDIDATE_TEST_FAILED'),
              target,
              errorCode: result.errorCode,
            };
        }
        if (!urls.length) return failure('API_ADDRESS_REQUIRED');
      } else {
        const result = await checked(target, next);
        if (!result.ok)
          return {
            ...failure('CANDIDATE_TEST_FAILED'),
            target,
            errorCode: result.errorCode,
          };
        if (
          target === 'zalo' &&
          keys.includes('ZALO_MODE') &&
          next.ZALO_MODE === 'polling' &&
          result.mode === 'webhook'
        )
          return failure('REMOVE_WEBHOOK_FIRST');
      }
    }
    return null;
  }
  async function save(body, actor) {
    if (
      !body ||
      Object.keys(body).some(
        k => !['expectedVersion', 'changes', 'secrets', 'confirm'].includes(k)
      )
    )
      return failure('INVALID_PAYLOAD');
    const changes = normalizeChanges(body),
      bad = store.validateChanges?.(changes);
    if (bad) return failure(bad);
    const keys = Object.keys(changes).filter(
      key => !getEntry(key)?.secret || changes[key].action !== 'keep'
    );
    if (
      keys.some(
        key =>
          getEntry(key)?.secret ||
          /OWNER|ADMIN_IDS|CHAT_ID|THREAD_ID|_URL|ZALO_MODE/.test(key)
      ) &&
      body.confirm !== true
    )
      return failure('CONFIRM_REQUIRED');
    const s = await store.snapshot();
    if (s.storageTransition) return failure('STORAGE_TRANSITION_PENDING', 409);
    if (body.expectedVersion !== s.version)
      return failure('STALE_VERSION', 409);
    const base = await resolved(s.version),
      next = candidate(base, changes),
      invalid = await validateCandidates(keys, next, base);
    if (invalid) return invalid;
    const result = await store.save({ ...body, changes, actor });
    return result.ok ? safe(result.snapshot) : result;
  }
  async function apply(body, actor) {
    if (body?.confirm !== true) return failure('CONFIRM_REQUIRED');
    const s = await store.snapshot();
    if (body.expectedVersion !== s.version)
      return failure('STALE_VERSION', 409);
    if (s.storageTransition && s.storageTransition.action !== 'apply')
      return failure('STORAGE_TRANSITION_PENDING', 409);
    const keys = changedKeys(s, s.versions[s.activeVersion] || {});
    if (
      keys.some(k => ['DATABASE_URL'].includes(k)) &&
      body.backupConfirmed !== true
    )
      return failure('BACKUP_REQUIRED');
    if (
      keys.some(k => DEPLOYMENT_KEYS.includes(k)) &&
      body.deploymentConfirmed !== true
    )
      return failure('DEPLOYMENT_REQUIRED');
    const next = await resolved(s.version),
      old = await resolved(s.activeVersion);
    const invalid = await validateCandidates(keys, next, old);
    if (invalid) return invalid;
    const result = keys.some(k => ['DATABASE_URL'].includes(k))
      ? await transitionStorage(body, actor, 'apply', s.version)
      : await store.apply(body.expectedVersion, actor);
    if (!result.ok) return result;
    return safe(result.snapshot);
  }
  async function transitionStorage(body, actor, action, target) {
    return store.exclusiveOperation(async () => {
      const started = await store.transaction(s => {
        if (body.expectedVersion !== s.version)
          return { write: false, value: failure('STALE_VERSION', 409) };
        if (s.storageTransition?.phase === 'starting' && action !== 'rollback')
          return {
            write: false,
            value: failure('STORAGE_TRANSITION_PENDING', 409),
          };
        s.storageTransition = { phase: 'stopping', target, action };
        for (const id of ['api', 'telegram', 'zalo-polling', 'zalo-webhook'])
          s.services[id] = {
            ...(s.services[id] || {}),
            desiredState: 'stopped',
          };
        return { value: { ok: true } };
      });
      if (!started.ok) return started;
      const deadline = Date.now() + 8000;
      do {
        const state = await store.snapshot();
        const leased = ['api', 'telegram', 'zalo-polling', 'zalo-webhook'].some(
          id => state.services[`${id}:lease`]?.expiresAt > now()
        );
        if (!leased && state.services.api?.state === 'stopped') {
          // Keep the transition flag until the new API confirms readiness.
          const result = await store[action](body.expectedVersion, actor);
          return result;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      } while (Date.now() < deadline);
      return failure('STORAGE_QUIESCE_PENDING', 409);
    });
  }
  async function rollback(body, actor) {
    if (body?.confirm !== true) return failure('CONFIRM_REQUIRED');
    const s = await store.snapshot(),
      previous = s.versions[s.previousActiveVersion];
    if (!previous) return failure('NO_PREVIOUS_VERSION');
    const keys = changedKeys(previous, s.versions[s.activeVersion]);
    const storage = keys.some(k => ['DATABASE_URL'].includes(k));
    if (storage && body.backupConfirmed !== true)
      return failure('BACKUP_REQUIRED');
    const result = storage
      ? await transitionStorage(
          body,
          actor,
          'rollback',
          s.previousActiveVersion
        )
      : await store.rollback(body.expectedVersion, actor);
    return result.ok ? safe(result.snapshot) : result;
  }
  async function restart(body, actor) {
    if (body?.confirm !== true) return failure('CONFIRM_REQUIRED');
    if (!SERVICES.includes(body.service)) return failure('INVALID_SERVICE');
    const result = await store.transaction(s => {
      if (s.storageTransition)
        return {
          write: false,
          value: failure('STORAGE_TRANSITION_PENDING', 409),
        };
      if (body.expectedVersion !== s.version)
        return { write: false, value: failure('STALE_VERSION', 409) };
      s.services[body.service] = {
        ...(s.services[body.service] || {}),
        desiredState: 'running',
        state: 'pending',
        restartGeneration:
          (s.services[body.service]?.restartGeneration || 0) + 1,
      };
      s.audit.push({
        version: s.version,
        action: 'restart',
        actor,
        keys: [body.service],
        at: clock().toISOString(),
      });
      return { value: s };
    });
    return result.ok === false ? result : safe(result);
  }
  async function quiesce() {
    await store.transaction(s => {
      for (const id of ['zalo-polling', 'zalo-webhook'])
        s.services[id] = { ...(s.services[id] || {}), desiredState: 'stopped' };
    });
    const deadline = Date.now() + 8000;
    do {
      const s = await store.snapshot();
      const leases = ['zalo-polling', 'zalo-webhook'].some(
        id => s.services[`${id}:lease`]?.expiresAt > now()
      );
      if (!leases)
        return { stopped: true, leaseReleased: true, leaseGone: true };
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    throw Object.assign(new Error('POLLING_QUIESCE_REQUIRED'), {
      code: 'POLLING_QUIESCE_REQUIRED',
    });
  }
  async function operationInternal(action, body = {}, actor, options = {}) {
    if (!ACTIONS.has(action)) return failure('UNKNOWN_OPERATION');
    const s = await store.snapshot();
    if (
      body.expectedVersion !== undefined &&
      body.expectedVersion !== s.version
    )
      return failure('STALE_VERSION', 409);
    if (s.storageTransition) return failure('STORAGE_TRANSITION_PENDING', 409);
    const activeEnv = await resolved(s.activeVersion);
    let pool;
    try {
      let repository = options.repository;
      if (
        !repository &&
        operationImpl === runManagementOperation &&
        !action.startsWith('webhook-')
      ) {
        if (!activeEnv.DATABASE_URL) return failure('DATABASE_REQUIRED');
        pool = poolFactory
          ? poolFactory(activeEnv.DATABASE_URL)
          : new (require('pg').Pool)({
              ...require('../db/managed-connection').managedConnectionOptions(
                activeEnv.DATABASE_URL,
                env
              ),
              max: 2,
              connectionTimeoutMillis: 3000,
              query_timeout: 5000,
            });
        repository = createZaloAnnouncementRepository({ database: pool });
      }
      const result = await operationImpl(action, body, {
        ...options,
        repository,
        env: activeEnv,
        actor: { id: actor || 'admin' },
        fetchImpl,
        quiesce: quiesceImpl || quiesce,
      });
      if (
        result.ok !== false &&
        [
          'webhook-register',
          'webhook-remove',
          'subscriber-remove',
          'announcement-send',
        ].includes(action)
      )
        await store.transaction(state => {
          state.audit.push({
            version: state.version,
            action,
            actor,
            keys: [],
            at: clock().toISOString(),
          });
        });
      return result;
    } finally {
      await pool?.end();
    }
  }
  const operation = async (...args) => {
    if ((await store.snapshot()).storageTransition)
      return failure('STORAGE_TRANSITION_PENDING', 409);
    return store.exclusiveOperation(() => operationInternal(...args));
  };
  return {
    snapshot,
    runtime,
    report,
    lease,
    save,
    test,
    operation,
    apply,
    rollback,
    restart,
    applyPlan: async () => plan(await store.snapshot()),
    store,
  };
}
module.exports = { createManagementService, SERVICES };
