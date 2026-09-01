const { EventEmitter } = require('node:events');

const ZALO_API_BASE_URL = 'https://bot-api.zaloplatforms.com';
const DEFAULT_POLL_TIMEOUT_SECONDS = 30;
const DEFAULT_RETRY_DELAY_MS = 1000;

function requireText(value, field) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new TypeError(`${field} is required.`);
  }

  return text;
}

function normalizeBotToken(value) {
  const token = requireText(value, 'Zalo bot token');

  if (/[/\s]/.test(token)) {
    throw new TypeError('Zalo bot token contains unsupported characters.');
  }

  return token;
}

function unwrapZaloUpdate(update) {
  if (
    update &&
    typeof update === 'object' &&
    !Array.isArray(update) &&
    update.ok === true &&
    update.result &&
    typeof update.result === 'object'
  ) {
    return update.result;
  }

  return update;
}

function extractZaloMessage(update) {
  const result = unwrapZaloUpdate(update);

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }

  if (
    result.event_name != null &&
    result.event_name !== 'message.text.received'
  ) {
    return null;
  }

  const message =
    result.message && typeof result.message === 'object'
      ? result.message
      : result;

  if (
    typeof message.text !== 'string' ||
    message.from?.id == null ||
    message.chat?.id == null
  ) {
    return null;
  }

  return message;
}

function normalizeUpdates(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.updates)) {
    return result.updates;
  }

  return result && typeof result === 'object' ? [result] : [];
}

function createZaloApiError(method, response, payload) {
  const description =
    typeof payload?.description === 'string'
      ? payload.description
      : `Zalo Bot API request failed: ${method}`;
  const error = new Error(description);
  error.name = 'ZaloApiError';
  error.method = method;
  error.statusCode = response?.status ?? null;
  error.errorCode = payload?.error_code ?? null;
  return error;
}

function defaultWait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

class ZaloBotClient extends EventEmitter {
  constructor({
    token,
    fetcher = globalThis.fetch,
    apiBaseUrl = ZALO_API_BASE_URL,
    pollTimeoutSeconds = DEFAULT_POLL_TIMEOUT_SECONDS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    wait = defaultWait,
    onError = error => console.error('❌ [zalo.client]', error),
  } = {}) {
    super();

    if (typeof fetcher !== 'function') {
      throw new TypeError('Zalo bot client requires fetch.');
    }

    if (!Number.isInteger(pollTimeoutSeconds) || pollTimeoutSeconds <= 0) {
      throw new TypeError('Zalo polling timeout must be a positive integer.');
    }

    if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
      throw new TypeError('Zalo retry delay must be a non-negative number.');
    }

    if (typeof wait !== 'function' || typeof onError !== 'function') {
      throw new TypeError('Zalo client callbacks must be functions.');
    }

    this.token = normalizeBotToken(token);
    this.fetcher = fetcher;
    this.apiBaseUrl = requireText(apiBaseUrl, 'Zalo API base URL').replace(
      /\/+$/,
      ''
    );
    this.pollTimeoutSeconds = pollTimeoutSeconds;
    this.retryDelayMs = retryDelayMs;
    this.wait = wait;
    this.onError = onError;
    this.polling = false;
    this.pollingPromise = null;
    this.pollAbortController = null;
  }

  getMethodUrl(method) {
    const normalizedMethod = requireText(method, 'Zalo API method');

    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(normalizedMethod)) {
      throw new TypeError('Zalo API method is invalid.');
    }

    return `${this.apiBaseUrl}/bot${this.token}/${normalizedMethod}`;
  }

  async call(method, payload = {}, { signal } = {}) {
    const response = await this.fetcher(this.getMethodUrl(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    let data;

    try {
      data = await response.json();
    } catch {
      throw createZaloApiError(method, response, null);
    }

    if (!response.ok || data?.ok !== true) {
      throw createZaloApiError(method, response, data);
    }

    return data.result;
  }

  getMe() {
    return this.call('getMe');
  }

  getUpdates({ timeout = this.pollTimeoutSeconds, signal } = {}) {
    return this.call('getUpdates', { timeout: String(timeout) }, { signal });
  }

  sendMessage(chatId, text, options = {}) {
    const message = String(text ?? '');

    if (message.length < 1 || message.length > 2000) {
      throw new RangeError(
        'Zalo message text must contain 1 to 2000 characters.'
      );
    }

    const payload = {
      chat_id: requireText(chatId, 'Zalo chat ID'),
      text: message,
    };

    if (options.parse_mode === 'markdown' || options.parse_mode === 'html') {
      payload.parse_mode = options.parse_mode;
    }

    if (Array.isArray(options.text_styles)) {
      payload.text_styles = options.text_styles;
    }

    return this.call('sendMessage', payload);
  }

  setWebhook(url, secretToken) {
    const webhookUrl = new URL(requireText(url, 'Zalo webhook URL'));
    const secret = requireText(secretToken, 'Zalo webhook secret');

    if (webhookUrl.protocol !== 'https:') {
      throw new TypeError('Zalo webhook URL must use HTTPS.');
    }

    if (secret.length < 8 || secret.length > 256) {
      throw new RangeError(
        'Zalo webhook secret must contain 8 to 256 characters.'
      );
    }

    return this.call('setWebhook', {
      url: webhookUrl.toString(),
      secret_token: secret,
    });
  }

  getWebhookInfo() {
    return this.call('getWebhookInfo');
  }

  testWebhook() {
    return this.call('testWebhook');
  }

  deleteWebhook() {
    return this.call('deleteWebhook');
  }

  processUpdate(update) {
    const normalized = unwrapZaloUpdate(update);
    const message = extractZaloMessage(normalized);

    this.emit('update', normalized);

    if (message) {
      this.emit('message', message);
    }

    return normalized;
  }

  async pollOnce({ signal } = {}) {
    const result = await this.getUpdates({ signal });
    const updates = normalizeUpdates(result);

    updates.forEach(update => this.processUpdate(update));
    return updates.length;
  }

  startPolling() {
    if (this.polling) {
      return this;
    }

    this.polling = true;
    this.pollingPromise = this.runPolling();
    return this;
  }

  async runPolling() {
    while (this.polling) {
      this.pollAbortController = new AbortController();

      try {
        await this.pollOnce({ signal: this.pollAbortController.signal });
      } catch (error) {
        if (!this.polling && error?.name === 'AbortError') {
          break;
        }

        this.onError(error);

        if (this.polling && this.retryDelayMs > 0) {
          await this.wait(this.retryDelayMs);
        }
      } finally {
        this.pollAbortController = null;
      }
    }
  }

  async stopPolling() {
    if (!this.polling) {
      return;
    }

    this.polling = false;
    this.pollAbortController?.abort();
    await this.pollingPromise;
    this.pollingPromise = null;
  }
}

function createZaloBotClient(options) {
  return new ZaloBotClient(options);
}

module.exports = {
  DEFAULT_POLL_TIMEOUT_SECONDS,
  DEFAULT_RETRY_DELAY_MS,
  ZALO_API_BASE_URL,
  ZaloBotClient,
  createZaloApiError,
  createZaloBotClient,
  extractZaloMessage,
  normalizeUpdates,
  unwrapZaloUpdate,
};
