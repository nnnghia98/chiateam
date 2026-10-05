const { randomUUID } = require('node:crypto');
const DEFAULT_READY_TIMEOUT_MS = 15000;
const DEFAULT_STOP_TIMEOUT_MS = 10000;
const CODES = new Set([
  'START_FAILED',
  'READY_TIMEOUT',
  'STOP_TIMEOUT',
  'CHILD_EXIT',
  'STALE_VERSION',
  'LEASE_UNAVAILABLE',
  'LEASE_LOST',
  'MANAGEMENT_UNAVAILABLE',
]);
function safeError(error) {
  const code = CODES.has(error?.code) ? error.code : 'START_FAILED';
  return { code, message: code };
}
function createManagedProcessSupervisor({
  service,
  entrypoint,
  forkImpl = require('node:child_process').fork,
  env = process.env,
  resolveEnv = async () => ({ ...env }),
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
  stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS,
  instanceId = randomUUID(),
} = {}) {
  if (!service || !entrypoint)
    throw new TypeError('Managed service and entrypoint are required');
  let permitted = true;
  let child = null,
    applied = null,
    appliedEnv = null,
    generation = 0,
    serial = Promise.resolve();
  const exited = new WeakSet();
  function enqueue(action) {
    const result = serial.then(action);
    serial = result.catch(() => {});
    return result;
  }
  async function stopChild(target) {
    if (
      !target ||
      exited.has(target) ||
      target.exitCode != null ||
      target.signalCode != null
    )
      return;
    await new Promise((resolve, reject) => {
      let exitTimer;
      const cleanup = () => {
        clearTimeout(killTimer);
        clearTimeout(exitTimer);
        target.removeListener('exit', done);
      };
      const done = () => {
        exited.add(target);
        cleanup();
        resolve();
      };
      target.once('exit', done);
      const killTimer = setTimeout(() => {
        try {
          target.kill('SIGKILL');
        } catch {
          /* still require proof of exit */
        }
        exitTimer = setTimeout(() => {
          cleanup();
          reject(
            Object.assign(new Error('STOP_TIMEOUT'), { code: 'STOP_TIMEOUT' })
          );
        }, stopTimeoutMs);
      }, stopTimeoutMs);
      try {
        target.send?.({ type: 'stop' });
      } catch {
        /* the process may already be gone */
      }
      try {
        target.kill('SIGTERM');
      } catch {
        /* the process may already be gone */
      }
    });
  }
  async function start(version, resolved) {
    if (!permitted)
      throw Object.assign(new Error('LEASE_LOST'), { code: 'LEASE_LOST' });
    const childEnv = Object.fromEntries(
      Object.entries({
        ...resolved,
        MANAGEMENT_CHILD: 'true',
        MANAGEMENT_SERVICE: service,
        MANAGEMENT_INSTANCE_ID: instanceId,
      }).map(([key, value]) => [key, String(value ?? '')])
    );
    childEnv.MANAGEMENT_BOOTSTRAP = '';
    const candidate = forkImpl(entrypoint, [], {
      env: childEnv,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    child = candidate;
    candidate.once('exit', () => {
      exited.add(candidate);
      if (child === candidate) child = null;
    });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            finish(
              Object.assign(new Error('READY_TIMEOUT'), {
                code: 'READY_TIMEOUT',
              })
            ),
          readyTimeoutMs
        );
        const onMessage = message => {
          if (message?.type === 'ready' && message.service === service)
            finish(
              permitted
                ? undefined
                : Object.assign(new Error('LEASE_LOST'), { code: 'LEASE_LOST' })
            );
          else if (message?.type === 'failed')
            finish(
              Object.assign(new Error('START_FAILED'), { code: 'START_FAILED' })
            );
        };
        const onExit = () =>
          finish(
            Object.assign(new Error('CHILD_EXIT'), { code: 'CHILD_EXIT' })
          );
        const onError = () =>
          finish(
            Object.assign(new Error('START_FAILED'), { code: 'START_FAILED' })
          );
        let done = false;
        function finish(error) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          candidate.removeListener('message', onMessage);
          candidate.removeListener('exit', onExit);
          candidate.removeListener('error', onError);
          error ? reject(error) : resolve();
        }
        candidate.on('message', onMessage);
        candidate.once('exit', onExit);
        candidate.once('error', onError);
      });
      generation++;
    } catch (error) {
      await stopChild(candidate);
      if (child === candidate) child = null;
      throw error;
    }
  }
  function apply(version, extraEnv = {}) {
    return enqueue(async () => {
      // Resolve before interrupting the working process.
      const resolved = { ...(await resolveEnv(version)), ...extraEnv };
      const previousVersion = applied,
        previousEnv = appliedEnv;
      await stopChild(child);
      child = null;
      try {
        await start(version, resolved);
        applied = version;
        appliedEnv = resolved;
        return { state: 'applied', version, restartGeneration: generation };
      } catch (error) {
        const failure = safeError(error);
        if (permitted && failure.code !== 'STOP_TIMEOUT' && previousEnv) {
          try {
            await start(previousVersion, previousEnv);
            applied = previousVersion;
          } catch {
            applied = null;
          }
        } else if (!child) applied = null;
        throw Object.assign(new Error(failure.code), {
          ...failure,
          errorCode: failure.code,
          appliedVersion: child ? applied : null,
          state: 'failed',
        });
      }
    });
  }
  function suspend() {
    permitted = false;
    try {
      child?.kill('SIGTERM');
    } catch {
      /* the process may already be gone */
    }
    return enqueue(async () => {
      await stopChild(child);
      child = null;
    });
  }
  return Object.freeze({
    service,
    instanceId,
    apply,
    allow: () => {
      permitted = true;
    },
    suspend,
    stop: () =>
      enqueue(async () => {
        await stopChild(child);
        child = null;
      }),
    getState: () => ({
      service,
      appliedVersion: child ? applied : null,
      restartGeneration: generation,
      running: Boolean(child),
    }),
  });
}
function sendReady(service, details = {}) {
  process.send?.({ type: 'ready', service, ...details });
}
module.exports = {
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_STOP_TIMEOUT_MS,
  createManagedProcessSupervisor,
  sendReady,
  safeError,
};
