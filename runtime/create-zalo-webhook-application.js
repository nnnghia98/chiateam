const { createZaloBotClient } = require('../platforms/zalo/client');
const {
  createZaloPermissionPolicy,
} = require('../platforms/zalo/permission-policy');
const { createZaloWebhookHandler } = require('../platforms/zalo/webhook');
const {
  createZaloCommandDefinitions,
} = require('./create-zalo-command-definitions');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');
const {
  createApiWebhookEventRepository,
} = require('./repositories/api-webhook-event-repository');
const { startZaloBotRuntime } = require('./start-zalo-bot');
const {
  createApiZaloGreetingRepository,
} = require('./repositories/api-zalo-greeting-repository');
const {
  createApiZaloAnnouncementRepository,
} = require('./repositories/api-zalo-announcement-repository');

function requireEnvironmentValue(env, name) {
  const value = String(env?.[name] ?? '').trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function createZaloWebhookApplication({
  env = process.env,
  client,
  stateRepository,
  eventRepository,
  permissionPolicy,
  definitions,
  commandGate,
  subscriptionRepository,
  greetingRepository,
  secretToken,
  leaseGuard = async () => {},
  onError = () => console.error('Zalo webhook command failed'),
} = {}) {
  const request = async (pathname, options) => {
    await leaseGuard();
    return require('../bot/utils/api-client').requestJson(pathname, {
      ...options,
      env,
    });
  };
  subscriptionRepository ||= createApiZaloAnnouncementRepository({ request });
  greetingRepository ||= createApiZaloGreetingRepository({ request });
  const rawClient =
    client ||
    createZaloBotClient({
      token: requireEnvironmentValue(env, 'ZALO_BOT_TOKEN'),
      fetcher: (url, options = {}) =>
        fetch(url, {
          ...options,
          redirect: 'error',
          signal: AbortSignal.any([
            AbortSignal.timeout(10000),
            ...(options.signal ? [options.signal] : []),
          ]),
        }),
      onError,
    });
  const activeClient = new Proxy(rawClient, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (
        typeof value !== 'function' ||
        property === 'on' ||
        property === 'once' ||
        property === 'addListener' ||
        property === 'removeListener'
      )
        return value;
      return async (...args) => {
        await leaseGuard();
        return value.apply(target, args);
      };
    },
  });
  const runtime = startZaloBotRuntime({
    client: activeClient,
    env,
    subscriptionRepository,
    greetingRepository,
    stateRepository:
      stateRepository ||
      createApiStateRepository({
        read: () => request('/api/bot-storage', { method: 'GET' }),
        write: body => request('/api/bot-storage', { method: 'POST', body }),
      }),
    permissionPolicy: permissionPolicy || createZaloPermissionPolicy({ env }),
    definitions:
      definitions ||
      createZaloCommandDefinitions({ subscriptionRepository, env }),
    listenForClientEvents: false,
    mode: 'webhook',
    commandGate,
    onError,
  });
  const handleWebhook = createZaloWebhookHandler({
    adapter: runtime.adapter,
    secretToken:
      secretToken || requireEnvironmentValue(env, 'ZALO_WEBHOOK_SECRET'),
    eventRepository:
      eventRepository || createApiWebhookEventRepository({ request }),
  });

  return Object.freeze({
    client: activeClient,
    runtime,
    handleWebhook,
    stop: () => runtime.stop(),
  });
}

// Keeps webhook requests on one immutable configuration snapshot. A new
// application is created only after the management version changes, and the
// previous one is drained before it is discarded.
function createManagedWebhookApplication({
  createApplication = createZaloWebhookApplication,
  getSnapshot,
  report = async () => {},
  lease,
} = {}) {
  if (
    typeof createApplication !== 'function' ||
    typeof getSnapshot !== 'function'
  )
    throw new TypeError('Managed webhook requires factory and snapshot reader');
  let current = null,
    serial = Promise.resolve();
  const instanceId = require('node:crypto').randomUUID();
  function enqueue(action) {
    const result = serial.then(action);
    serial = result.catch(() => {});
    return result;
  }
  async function resolve() {
    const snapshot = await getSnapshot();
    if (!Number.isInteger(snapshot?.version) || !snapshot.env)
      throw new Error('INVALID_RUNTIME');
    if (
      snapshot.env.ZALO_MODE !== 'webhook' ||
      snapshot.receiverBlocked ||
      snapshot.desiredState === 'stopped'
    ) {
      await current?.application.stop?.();
      current = null;
      await report({ version: snapshot.version, instanceId, state: 'stopped' });
      return null;
    }
    const signature = `${snapshot.version}:${snapshot.restartGeneration || 0}`;
    if (!current || current.signature !== signature) {
      await current?.application.stop?.();
      current = null;
      const env = require('./managed-bootstrap').childEnvironment(
        'zalo-webhook',
        snapshot,
        process.env
      );
      const leaseState = { request: null, starting: true };
      const next = createApplication({
        env,
        leaseGuard: async () => {
          const active = leaseState.request;
          if (!active) {
            if (leaseState.starting) return;
            throw Object.assign(new Error('LEASE_LOST'), {
              code: 'LEASE_LOST',
            });
          }
          if (
            !active.valid ||
            (active.expiresAt && active.expiresAt <= Date.now())
          ) {
            active.valid = false;
            throw Object.assign(new Error('LEASE_LOST'), {
              code: 'LEASE_LOST',
            });
          }
          try {
            const renewed = await active.renew();
            if (
              !renewed?.granted ||
              (renewed.expiresAt &&
                new Date(renewed.expiresAt).getTime() <= Date.now())
            )
              throw new Error('LEASE_LOST');
            if (!active.valid || leaseState.request !== active)
              throw new Error('LEASE_LOST');
            if (renewed.expiresAt)
              active.expiresAt = new Date(renewed.expiresAt).getTime();
            return renewed;
          } catch {
            active.valid = false;
            throw Object.assign(new Error('LEASE_LOST'), {
              code: 'LEASE_LOST',
            });
          }
        },
      });
      try {
        await next.client?.getMe?.();
      } catch {
        await next.stop?.();
        await report({
          version: snapshot.version,
          instanceId,
          state: 'failed',
          errorCode: 'START_FAILED',
        });
        throw new Error('START_FAILED');
      }
      leaseState.starting = false;
      current = { signature, application: next, leaseState };
    }
    await report({
      version: snapshot.version,
      instanceId,
      state: 'applied',
      healthy: true,
    });
    return current.application;
  }
  return Object.freeze({
    resolve: () => enqueue(resolve),
    handleWebhook: request =>
      enqueue(async () => {
        const app = await resolve();
        if (!app)
          return {
            statusCode: 503,
            body: { ok: false, error: 'RECEIVER_INACTIVE' },
          };
        const proof = lease
          ? await lease(instanceId, 'acquire')
          : { granted: true };
        if (!proof.granted)
          return {
            statusCode: 503,
            body: { ok: false, error: 'RECEIVER_BUSY' },
          };
        const requestState = {
          valid: true,
          expiresAt: proof.expiresAt ? new Date(proof.expiresAt).getTime() : 0,
          renew: () =>
            lease
              ? lease(instanceId, 'renew')
              : Promise.resolve({ granted: true }),
        };
        if (requestState) current.leaseState.request = requestState;
        const renew = lease
          ? setInterval(async () => {
              try {
                const renewed = await requestState.renew();
                if (!renewed?.granted) requestState.valid = false;
                else if (renewed.expiresAt)
                  requestState.expiresAt = new Date(
                    renewed.expiresAt
                  ).getTime();
              } catch {
                requestState.valid = false;
              }
            }, 5000)
          : null;
        try {
          return await app.handleWebhook(request);
        } catch (error) {
          if (error?.code === 'LEASE_LOST')
            return {
              statusCode: 503,
              body: { ok: false, error: 'RECEIVER_LEASE_LOST' },
            };
          throw error;
        } finally {
          if (renew) clearInterval(renew);
          if (lease) await lease(instanceId, 'release');
          if (requestState) {
            requestState.valid = false;
            if (current.leaseState.request === requestState)
              current.leaseState.request = null;
          }
        }
      }),
    stop: () =>
      enqueue(async () => {
        await current?.application.stop?.();
        current = null;
      }),
  });
}

module.exports = {
  createZaloWebhookApplication,
  createManagedWebhookApplication,
  requireEnvironmentValue,
};
