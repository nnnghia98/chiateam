const DEFAULT_TIMEOUT_MS = 2500;

function getBaseUrl(env = process.env) {
  let value = String(
    env.BOT_API_BASE_URL ||
      env.API_INTERNAL_URL ||
      env.API_BASE_URL ||
      env.API_URL ||
      `http://127.0.0.1:${env.API_PORT || env.UI_API_PORT || 8787}`
  ).trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  return value.replace(/\/api$/i, '');
}

function createBotControlsClient({
  platform,
  mode,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger = console,
} = {}) {
  if (!['telegram', 'zalo'].includes(platform)) throw new TypeError('Invalid bot controls platform.');
  if (!['polling', 'webhook'].includes(mode)) throw new TypeError('Invalid bot controls mode.');
  if (typeof fetchImpl !== 'function') throw new TypeError('Bot controls requires fetch.');
  let sawSuccessfulContract = false;
  let warnedLegacy = false;

  async function check(command) {
    const token = String(
      env.INTERNAL_API_AUTH_TOKEN ||
        (env.NODE_ENV !== 'production'
          ? 'local-internal-api-token-change-me'
          : '')
    ).trim();
    if (!token && env.NODE_ENV === 'production') {
      return { available: false, commandsEnabled: false, reason: 'missing-auth' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${getBaseUrl(env)}/api/bot-controls/${platform}/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-api-auth': token },
        body: JSON.stringify({ mode }),
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 404 && !sawSuccessfulContract && env.BOT_CONTROLS_LEGACY_API === 'true') {
        if (!warnedLegacy) {
          warnedLegacy = true;
          logger.warn?.('Bot controls API is unavailable; using legacy enabled behavior.');
        }
        return { available: true, commandsEnabled: true, legacy: true };
      }
      if (!response.ok) return { available: false, commandsEnabled: false, reason: `http-${response.status}` };
      const body = await response.json();
      if (
        !body ||
        body.platform !== platform ||
        typeof body.commandsEnabled !== 'boolean' ||
        body.mode !== mode ||
        (body.lastCommandAt !== null && typeof body.lastCommandAt !== 'string') ||
        (body.updatedAt !== null && typeof body.updatedAt !== 'string')
      ) {
        return { available: false, commandsEnabled: false, reason: 'invalid-response' };
      }
      sawSuccessfulContract = true;
      return { available: true, commandsEnabled: body.commandsEnabled, details: body };
    } catch (error) {
      return { available: false, commandsEnabled: false, reason: 'request-failed' };
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({ check, platform, mode });
}

function createPermissiveBotControlsGate() {
  return Object.freeze({ async check() { return { available: true, commandsEnabled: true }; } });
}

function createBotControlsGate({ client, platform } = {}) {
  if (!client || typeof client.check !== 'function') throw new TypeError('Bot controls gate requires a client.');
  return Object.freeze({
    async check(context) {
      const result = await client.check(context?.command);
      if (platform === 'zalo' && context?.command === 'unsubscribe') return { available: true, commandsEnabled: true, bypass: true };
      return result;
    },
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  createBotControlsClient,
  createBotControlsGate,
  createPermissiveBotControlsGate,
};
