const {
  createCommandContext,
} = require('../../core/contracts/command-context');
const { extractMessengerMessage } = require('./client');
const { formatMessengerMessage, splitMessengerText } = require('./formatter');

const DEFAULT_INTERACTION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EVENT_TTL_MS = 60 * 60 * 1000;
const MESSENGER_CAPABILITIES = Object.freeze({
  buttons: false,
  messageEditing: false,
  nativePolls: false,
  threads: false,
});

function parseMessengerCommandText(text) {
  if (typeof text !== 'string') return null;
  const parts = text.trim().split(/\s+/);
  const token = parts.shift();
  if (!token || !/^\/[a-z0-9_-]+$/i.test(token)) return null;
  return { command: token.slice(1), args: parts };
}

function createMessengerAdapter({
  client,
  router,
  formatter = formatMessengerMessage,
  splitText = splitMessengerText,
  interactionTtlMs = DEFAULT_INTERACTION_TTL_MS,
  eventTtlMs = DEFAULT_EVENT_TTL_MS,
  now = Date.now,
  errorMessage = '❌ Có lỗi xảy ra. Vui lòng thử lại.',
  onError = error => console.error('❌ [messenger.adapter]', error),
} = {}) {
  if (
    !client ||
    typeof client.on !== 'function' ||
    typeof client.sendMessage !== 'function'
  ) {
    throw new TypeError('Messenger adapter requires a bot client.');
  }
  if (!router || typeof router.run !== 'function') {
    throw new TypeError('Messenger adapter requires a command router.');
  }
  if (
    !Number.isFinite(interactionTtlMs) ||
    interactionTtlMs <= 0 ||
    !Number.isFinite(eventTtlMs) ||
    eventTtlMs <= 0
  ) {
    throw new TypeError('Messenger TTL values must be positive numbers.');
  }
  if (
    typeof now !== 'function' ||
    typeof onError !== 'function' ||
    typeof formatter !== 'function' ||
    typeof splitText !== 'function'
  ) {
    throw new TypeError('Messenger adapter callbacks must be functions.');
  }

  let started = false;
  const pendingInputs = new Map();
  const processedEvents = new Map();
  const inFlightEvents = new Map();

  function createContext(event, parsed) {
    const message = extractMessengerMessage(event);
    if (!parsed || !message) return null;
    const sender = message.sender || event?.sender || event?.from || {};
    const psid = sender.id;
    if (psid == null) return null;
    return createCommandContext({
      ...parsed,
      actor: {
        platform: 'messenger',
        externalId: psid,
        displayName: sender.name || null,
        username: null,
      },
      conversation: { externalId: psid, threadId: null },
    });
  }

  function toCommandContext(event) {
    const message = extractMessengerMessage(event);
    return createContext(event, parseMessengerCommandText(message?.text));
  }
  function interactionKey(context) {
    return `${context.actor.externalId}:${context.conversation.externalId}`;
  }
  function rememberInput(context, input) {
    if (input)
      pendingInputs.set(interactionKey(context), {
        command: input.command,
        args: input.args,
        expiresAt: now() + interactionTtlMs,
      });
  }
  function takeInput(event) {
    const message = extractMessengerMessage(event);
    const text = String(message?.text ?? '').trim();
    if (!text || text.startsWith('/')) return null;
    const baseContext = createContext(event, { command: 'pending', args: [] });
    if (!baseContext) return null;
    const key = interactionKey(baseContext);
    const pending = pendingInputs.get(key);
    if (!pending) return null;
    pendingInputs.delete(key);
    if (pending.expiresAt <= now()) return null;
    return {
      context: createContext(event, {
        command: pending.command,
        args: [...pending.args, text],
      }),
      key,
      pending,
    };
  }
  async function sendResult(context, result) {
    for (const message of result.messages) {
      const rendered = formatter(message);
      for (const chunk of splitText(rendered.text)) {
        await client.sendMessage(
          context.conversation.externalId,
          chunk,
          rendered.options
        );
      }
      rememberInput(context, message.input);
    }
  }
  async function handleEvent(event) {
    const explicit = toCommandContext(event);
    const pending = explicit ? null : takeInput(event);
    const context = explicit || pending?.context;
    if (!context) return false;
    if (explicit) pendingInputs.delete(interactionKey(context));
    const routed = await router.run(context);
    if (!routed.handled) {
      if (pending) pendingInputs.set(pending.key, pending.pending);
      return false;
    }
    await sendResult(context, routed.result);
    return true;
  }
  function removeExpiredEvents() {
    const current = now();
    for (const [id, expiresAt] of processedEvents)
      if (expiresAt <= current) processedEvents.delete(id);
  }
  async function handleUpdate(update) {
    const message = extractMessengerMessage(update);
    if (!message) return false;
    const eventId = String(message.mid || message.message_id || '').trim();
    if (!eventId) return handleEvent(update);
    removeExpiredEvents();
    if (processedEvents.has(eventId)) return true;
    if (inFlightEvents.has(eventId)) return inFlightEvents.get(eventId);
    const task = handleEvent(update)
      .then(handled => {
        processedEvents.set(eventId, now() + eventTtlMs);
        return handled;
      })
      .finally(() => inFlightEvents.delete(eventId));
    inFlightEvents.set(eventId, task);
    return task;
  }
  async function reportError(event, error) {
    onError(error);
    const context = toCommandContext(event);
    if (!context) return;
    try {
      await client.sendMessage(context.conversation.externalId, errorMessage);
    } catch (sendError) {
      onError(sendError);
    }
  }
  const eventHandler = event => {
    void handleUpdate(event).catch(error => reportError(event, error));
  };
  function start() {
    if (!started) {
      client.on('message', eventHandler);
      started = true;
    }
    return adapter;
  }
  function stop() {
    if (!started) return;
    if (typeof client.removeListener === 'function')
      client.removeListener('message', eventHandler);
    pendingInputs.clear();
    processedEvents.clear();
    inFlightEvents.clear();
    started = false;
  }
  const adapter = Object.freeze({
    capabilities: MESSENGER_CAPABILITIES,
    toCommandContext,
    sendResult,
    handleEvent,
    handleUpdate,
    start,
    stop,
  });
  return adapter;
}

module.exports = {
  DEFAULT_EVENT_TTL_MS,
  DEFAULT_INTERACTION_TTL_MS,
  MESSENGER_CAPABILITIES,
  createMessengerAdapter,
  parseMessengerCommandText,
};
