const path = require('node:path');
const {
  createManagedProcessSupervisor,
  sendReady,
  safeError,
} = require('./managed-process');
const {
  createManagedRuntimeClient,
  SERVICE_TOKEN_ENV,
} = require('./managed-runtime-client');
const { getCatalog } = require('../api/management/catalog');
function isManagedChild(env = process.env) {
  return env.MANAGEMENT_CHILD === 'true';
}
function shouldDelegate(env = process.env) {
  return (
    ['true', '1'].includes(String(env.MANAGEMENT_BOOTSTRAP || '')) &&
    !isManagedChild(env)
  );
}
function childEnvironment(service, snapshot, env) {
  const result = {};
  for (const key of [
    'PATH',
    'HOME',
    'TMPDIR',
    'TZ',
    'LANG',
    'NODE_ENV',
    'NODE_EXTRA_CA_CERTS',
    'RAILWAY_VOLUME_MOUNT_PATH',
  ])
    if (env[key] != null) result[key] = env[key];
  for (const entry of getCatalog())
    if (entry.services.includes(service)) {
      const value = snapshot.env?.[entry.key];
      result[entry.key] =
        value == null
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
    }
  const specific =
    service === 'telegram'
      ? 'TELEGRAM_API_URL'
      : service.startsWith('zalo')
        ? 'ZALO_API_URL'
        : null;
  const apiUrl =
    (specific && result[specific]) ||
    result.API_INTERNAL_URL ||
    result.BOT_API_BASE_URL ||
    result.API_BASE_URL;
  if (apiUrl) {
    result.API_INTERNAL_URL = apiUrl;
    result.BOT_API_BASE_URL = apiUrl;
    result.API_BASE_URL = apiUrl;
  }
  // Only this service's bootstrap credential crosses into its child.
  for (const key of [
    'MANAGEMENT_API_URL',
    'MANAGEMENT_ALLOWED_ORIGINS',
    SERVICE_TOKEN_ENV[service],
  ])
    if (key && env[key]) result[key] = env[key];
  return result;
}
function directClient(service, env) {
  const management =
    require('../api/management/service').createManagementService({ env });
  return {
    getSettings: () => management.runtime(service),
    report: payload => management.report(service, payload),
    lease: (instanceId, action) =>
      management.lease(service, { instanceId, action }),
    close: () => management.store.close?.(),
  };
}
function startManagedSupervisor({
  service,
  entrypoint,
  env = process.env,
  forkImpl,
  runtimeClient,
  logger = console,
  refreshMs = 3000,
  installSignals = true,
  supervisorOptions = {},
} = {}) {
  const client =
    runtimeClient ||
    (service === 'api'
      ? directClient(service, env)
      : createManagedRuntimeClient({ service, env }));
  let currentSnapshot = null,
    stopped = false,
    timer = null,
    working = null,
    lastAttempt = null,
    held = false,
    lastRenew = 0,
    renewing = false;
  const polling = service === 'telegram' || service === 'zalo-polling';
  const leased = polling || service === 'api';
  const supervisor = createManagedProcessSupervisor({
    service,
    entrypoint: path.resolve(entrypoint),
    forkImpl,
    resolveEnv: async version => {
      if (currentSnapshot?.version !== version)
        throw Object.assign(new Error('STALE_VERSION'), {
          code: 'STALE_VERSION',
        });
      return childEnvironment(service, currentSnapshot, env);
    },
    ...supervisorOptions,
  });
  const report = async (state, errorCode) =>
    client
      .report({
        version: currentSnapshot.version,
        instanceId: supervisor.instanceId,
        state,
        healthy: state === 'applied',
        ...(errorCode ? { errorCode } : {}),
        appliedVersion: supervisor.getState().appliedVersion,
      })
      .catch(() => {});
  async function stopReceiver() {
    await supervisor.stop();
    if (held) {
      await client.lease(supervisor.instanceId, 'release');
      held = false;
    }
  }
  async function tick() {
    if (stopped) return;
    if (working) return working;
    working = (async () => {
      try {
        const next = await client.getSettings();
        if (
          !Number.isInteger(next?.version) ||
          !next.env ||
          typeof next.env !== 'object'
        )
          throw new Error('INVALID_RUNTIME');
        currentSnapshot = next;
        const inactive =
          next.desiredState === 'stopped' ||
          (service === 'api' &&
            (!next.env.INTERNAL_API_AUTH_TOKEN || !next.env.DATABASE_URL)) ||
          (service === 'zalo-polling' && next.env.ZALO_MODE === 'webhook') ||
          (polling &&
            !next.env[
              service === 'telegram' ? 'TELEGRAM_BOT_TOKEN' : 'ZALO_BOT_TOKEN'
            ]);
        if (inactive) {
          await stopReceiver();
          lastAttempt = null;
          await report('stopped');
          return;
        }
        if (leased) {
          const lease = await client.lease(
            supervisor.instanceId,
            held ? 'renew' : 'acquire'
          );
          if (!lease?.granted) {
            await stopReceiver();
            lastAttempt = null;
            await report('failed', 'LEASE_UNAVAILABLE');
            return;
          }
          held = true;
          lastRenew = Date.now();
        }
        const signature = `${next.version}:${next.restartGeneration || 0}`;
        if (signature !== lastAttempt) {
          lastAttempt = signature;
          supervisor.allow();
          await report('pending');
          try {
            await supervisor.apply(next.version);
            await report('applied');
          } catch (error) {
            await report('failed', safeError(error).code);
            logger.error?.(`[managed:${service}] ${safeError(error).code}`);
          }
        } else if (supervisor.getState().running)
          await report(
            supervisor.getState().appliedVersion === next.version
              ? 'applied'
              : 'failed'
          );
        else {
          lastAttempt = null;
          await report('failed', 'CHILD_EXIT');
        }
      } catch (error) {
        // Fail closed before the 30-second receiver lease can expire.
        if (leased && held) {
          held = false;
          lastAttempt = null;
          await supervisor.suspend().catch(() => {});
        }
        logger.error?.(`[managed:${service}] MANAGEMENT_UNAVAILABLE`);
      }
    })().finally(() => {
      working = null;
    });
    return working;
  }
  const ready = tick();
  timer = setInterval(() => void tick(), Math.min(refreshMs, 10000));
  const renewTimer = setInterval(
    async () => {
      if (!leased || !held || stopped || renewing) return;
      renewing = true;
      try {
        const proof = await client.lease(supervisor.instanceId, 'renew');
        if (!proof?.granted) throw new Error('LEASE_LOST');
        lastRenew = Date.now();
      } catch {
        held = false;
        lastAttempt = null;
        await supervisor.suspend().catch(() => {});
      } finally {
        renewing = false;
      }
    },
    Math.min(refreshMs, 5000)
  );
  async function stop() {
    stopped = true;
    clearInterval(timer);
    clearInterval(renewTimer);
    await working;
    await stopReceiver();
    await client.close?.();
    if (installSignals) {
      process.removeListener('SIGTERM', onSignal);
      process.removeListener('SIGINT', onSignal);
    }
  }
  const onSignal = () => {
    void stop()
      .then(() => {
        process.exitCode = 0;
      })
      .catch(() => {
        process.exitCode = 1;
      });
  };
  if (installSignals) {
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
  }
  return Object.freeze({
    ready,
    tick,
    stop,
    getState: supervisor.getState,
    instanceId: supervisor.instanceId,
  });
}
module.exports = {
  isManagedChild,
  shouldDelegate,
  startManagedSupervisor,
  sendReady,
  childEnvironment,
};
