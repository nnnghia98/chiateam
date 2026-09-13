const DEFAULT_TIMEOUT_MS = 2500;

const SERVICE_TOKEN_ENV = Object.freeze({
  api: 'MANAGEMENT_API_TOKEN',
  telegram: 'MANAGEMENT_TELEGRAM_TOKEN',
  'zalo-polling': 'MANAGEMENT_ZALO_POLLING_TOKEN',
  'zalo-webhook': 'MANAGEMENT_ZALO_WEBHOOK_TOKEN',
  admin: 'MANAGEMENT_ADMIN_SERVICE_TOKEN',
});

function createManagedRuntimeClient({
  service,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!service) throw new TypeError('Managed runtime service is required.');
  if (typeof fetchImpl !== 'function')
    throw new TypeError('Managed runtime client requires fetch.');
  function baseUrl() {
    let value = String(
      env.MANAGEMENT_API_URL ||
        env.API_INTERNAL_URL ||
        env.BOT_API_BASE_URL ||
        ''
    )
      .trim()
      .replace(/\/$/, '');
    if (value && !/^https?:\/\//i.test(value)) value = `http://${value}`;
    return value || `http://127.0.0.1:${env.API_PORT || 8787}`;
  }
  function headers() {
    const tokenName = SERVICE_TOKEN_ENV[service];
    const token = String((tokenName && env[tokenName]) || '').trim();
    if (!token)
      throw new Error(`Missing ${tokenName || 'MANAGEMENT_AUTH_TOKEN'}`);
    return { 'content-type': 'application/json', 'x-management-auth': token };
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        `${baseUrl().replace(/\/api$/, '')}${path}`,
        {
          ...options,
          headers: { ...headers(), ...(options.headers || {}) },
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw Object.assign(new Error('MANAGEMENT_UNAVAILABLE'), {
          code: body.errorCode || `HTTP_${response.status}`,
        });
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  return Object.freeze({
    getSettings: () =>
      request(`/api/management/runtime/${encodeURIComponent(service)}`),
    report: payload =>
      request(`/api/management/runtime/${encodeURIComponent(service)}/report`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    lease: (instanceId, action) =>
      request(`/api/management/runtime/${encodeURIComponent(service)}/lease`, {
        method: 'POST',
        body: JSON.stringify({ instanceId, action }),
      }),
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  SERVICE_TOKEN_ENV,
  createManagedRuntimeClient,
};
