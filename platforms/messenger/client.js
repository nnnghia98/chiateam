const { EventEmitter } = require('node:events');

const MESSENGER_GRAPH_BASE_URL = 'https://graph.facebook.com';
const DEFAULT_MESSENGER_GRAPH_API_VERSION = 'v26.0';
const MESSENGER_MESSAGE_MAX_LENGTH = 2000;

function requireText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${field} is required.`);
  return text;
}

function normalizeGraphVersion(value) {
  const version = requireText(value, 'Messenger Graph API version');
  if (!/^v\d+\.\d+$/.test(version))
    throw new TypeError('Messenger Graph API version is invalid.');
  return version;
}

function normalizePageId(value) {
  const pageId = requireText(value, 'Messenger page ID');
  if (!/^\d+$/.test(pageId))
    throw new TypeError('Messenger page ID is invalid.');
  return pageId;
}

function flattenMessengerEvents(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  return entries.flatMap(entry =>
    (Array.isArray(entry?.messaging) ? entry.messaging : [])
      .filter(
        event => event && typeof event === 'object' && !Array.isArray(event)
      )
      .map(event => ({ ...event, pageId: event.recipient?.id ?? entry.id }))
  );
}

function extractMessengerMessage(event) {
  const message = event?.message;
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message) ||
    message.is_echo === true ||
    typeof message.text !== 'string' ||
    event?.sender?.id == null ||
    event?.recipient?.id == null
  )
    return null;
  return {
    ...message,
    sender: event.sender,
    recipient: event.recipient,
    pageId: event.pageId ?? event.recipient.id,
    timestamp: event.timestamp,
  };
}

function extractMessengerMessages(payload) {
  return flattenMessengerEvents(payload)
    .map(extractMessengerMessage)
    .filter(Boolean);
}

function createMessengerApiError(method, response, payload) {
  const graphError = payload?.error;
  const error = new Error(
    typeof graphError?.message === 'string'
      ? graphError.message
      : `Messenger Graph API request failed: ${method}`
  );
  error.name = 'MessengerApiError';
  error.method = method;
  error.statusCode = response?.status ?? null;
  error.errorCode = graphError?.code ?? null;
  error.errorType = graphError?.type ?? null;
  return error;
}

class MessengerBotClient extends EventEmitter {
  constructor({
    pageId,
    pageAccessToken,
    fetcher = globalThis.fetch,
    graphBaseUrl = MESSENGER_GRAPH_BASE_URL,
    graphApiVersion = DEFAULT_MESSENGER_GRAPH_API_VERSION,
  } = {}) {
    super();
    if (typeof fetcher !== 'function')
      throw new TypeError('Messenger client requires fetch.');
    this.pageId = normalizePageId(pageId);
    this.pageAccessToken = requireText(
      pageAccessToken,
      'Messenger page access token'
    );
    this.fetcher = fetcher;
    this.graphBaseUrl = requireText(
      graphBaseUrl,
      'Messenger Graph API URL'
    ).replace(/\/+$/, '');
    this.graphApiVersion = normalizeGraphVersion(graphApiVersion);
  }

  getMessagesUrl() {
    return `${this.graphBaseUrl}/${this.graphApiVersion}/${this.pageId}/messages`;
  }

  sendMessage(recipientId, text) {
    const message = String(text ?? '');
    if (message.length < 1 || message.length > MESSENGER_MESSAGE_MAX_LENGTH)
      throw new RangeError(
        `Messenger message text must contain 1 to ${MESSENGER_MESSAGE_MAX_LENGTH} characters.`
      );
    return this._sendMessage(recipientId, message);
  }

  async _sendMessage(recipientId, message) {
    const response = await this.fetcher(this.getMessagesUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.pageAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_type: 'RESPONSE',
        recipient: { id: requireText(recipientId, 'Messenger recipient ID') },
        message: { text: message },
      }),
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw createMessengerApiError('sendMessage', response, null);
    }
    if (!response.ok || payload?.error)
      throw createMessengerApiError('sendMessage', response, payload);
    return payload;
  }

  processUpdate(update) {
    this.emit('update', update);
    flattenMessengerEvents(update).forEach(event => {
      const message = extractMessengerMessage(event);
      if (message) this.emit('message', { ...event, ...message });
    });
    return update;
  }
}

function createMessengerBotClient(options) {
  return new MessengerBotClient(options);
}

module.exports = {
  DEFAULT_MESSENGER_GRAPH_API_VERSION,
  MESSENGER_GRAPH_BASE_URL,
  MESSENGER_MESSAGE_MAX_LENGTH,
  MessengerBotClient,
  createMessengerApiError,
  createMessengerBotClient,
  extractMessengerMessage,
  extractMessengerMessages,
  flattenMessengerEvents,
  normalizeGraphVersion,
};
