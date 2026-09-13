const DEFAULT_RENEW_MS = 20_000;

function createManagedLease({
  client,
  instanceId,
  renewEveryMs = DEFAULT_RENEW_MS,
  onLost = () => {},
} = {}) {
  if (!client || typeof client.lease !== 'function')
    throw new TypeError('Managed lease client is required.');
  if (!instanceId)
    throw new TypeError('Managed lease instance ID is required.');
  let timer = null;
  let stopped = false;
  async function acquire() {
    const result = await client.lease(instanceId, 'acquire');
    if (!result?.granted)
      throw Object.assign(new Error('Polling lease is already held'), {
        code: 'LEASE_UNAVAILABLE',
      });
    timer = setInterval(() => void renew().catch(() => lose()), renewEveryMs);
    timer.unref?.();
    return result;
  }
  async function renew() {
    if (stopped) return { granted: false };
    const result = await client.lease(instanceId, 'renew');
    if (!result?.granted) lose();
    return result;
  }
  function lose() {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    onLost();
  }
  async function release() {
    stopped = true;
    if (timer) clearInterval(timer);
    return client
      .lease(instanceId, 'release')
      .catch(() => ({ granted: false }));
  }
  return Object.freeze({ acquire, renew, release, lose });
}

module.exports = { DEFAULT_RENEW_MS, createManagedLease };
