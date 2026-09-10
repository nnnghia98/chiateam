const {
  createCommandContext,
} = require('../../core/contracts/command-context');
const { extractZaloMessage } = require('./client');
const { formatZaloMessage, splitZaloText } = require('./formatter');
const {
  createZaloGreetingResult,
} = require('../../core/use-cases/common/zalo-greeting');

const DEFAULT_INTERACTION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EVENT_TTL_MS = 60 * 60 * 1000;

const ZALO_CAPABILITIES = Object.freeze({
  buttons: false,
  messageEditing: false,
  nativePolls: false,
  threads: false,
});

function parseZaloCommandText(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const parts = text.trim().split(/\s+/);
  const token = parts.shift();

  if (!token || !/^\/[a-z0-9_-]+$/i.test(token)) {
    return null;
  }

  return {
    command: token.slice(1),
    args: parts,
    rawArgs: text.trim().slice(token.length).trim(),
  };
}

function createZaloAdapter({
  client,
  router,
  formatter = formatZaloMessage,
  interactionTtlMs = DEFAULT_INTERACTION_TTL_MS,
  eventTtlMs = DEFAULT_EVENT_TTL_MS,
  now = Date.now,
  onPrivateMessage,
  greetingRepository,
  errorMessage = '❌ Có lỗi xảy ra. Vui lòng thử lại.',
  onError = error => console.error('❌ [zalo.adapter]', error),
} = {}) {
  if (
    !client ||
    typeof client.on !== 'function' ||
    typeof client.sendMessage !== 'function'
  ) {
    throw new TypeError('Zalo adapter requires a bot client.');
  }

  if (!router || typeof router.run !== 'function') {
    throw new TypeError('Zalo adapter requires a command router.');
  }

  if (
    !Number.isFinite(interactionTtlMs) ||
    interactionTtlMs <= 0 ||
    !Number.isFinite(eventTtlMs) ||
    eventTtlMs <= 0
  ) {
    throw new TypeError('Zalo TTL values must be positive numbers.');
  }

  if (typeof now !== 'function' || typeof onError !== 'function') {
    throw new TypeError('Zalo adapter callbacks must be functions.');
  }
  if (onPrivateMessage != null && typeof onPrivateMessage !== 'function') {
    throw new TypeError('Zalo private message callback must be a function.');
  }
  if (
    greetingRepository != null &&
    typeof greetingRepository.claim !== 'function'
  ) {
    throw new TypeError('Zalo greeting repository requires claim.');
  }

  let started = false;
  const pendingInputs = new Map();
  const processedEvents = new Map();
  const inFlightEvents = new Map();

  function createContext(event, parsed) {
    const message = extractZaloMessage(event, { textOnly: false });

    if (!parsed || !message) {
      return null;
    }

    return createCommandContext({
      ...parsed,
      actor: {
        platform: 'zalo',
        externalId: message.from.id,
        displayName: message.from.display_name,
        username: null,
      },
      conversation: {
        externalId: message.chat.id,
        threadId: null,
        type: message.chat.chat_type,
      },
    });
  }

  function toCommandContext(event) {
    const message = extractZaloMessage(event);
    return createContext(message, parseZaloCommandText(message?.text));
  }

  function getInteractionKey({ actor, conversation }) {
    return [actor.externalId, conversation.externalId].join(':');
  }

  function rememberInput(context, input) {
    if (!input) return;

    pendingInputs.set(getInteractionKey(context), {
      command: input.command,
      args: input.args,
      expiresAt: now() + interactionTtlMs,
    });
  }

  function clearInput(context) {
    pendingInputs.delete(getInteractionKey(context));
  }

  function takeInput(event) {
    const message = extractZaloMessage(event);
    const text = String(message?.text ?? '').trim();

    if (!text || text.startsWith('/')) {
      return null;
    }

    const baseContext = createContext(message, {
      command: 'pending',
      args: [],
    });

    if (!baseContext) {
      return null;
    }

    const key = getInteractionKey(baseContext);
    const pending = pendingInputs.get(key);

    if (!pending) {
      return null;
    }

    pendingInputs.delete(key);

    if (pending.expiresAt <= now()) {
      return null;
    }

    return {
      context: createContext(message, {
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

      for (const chunk of splitZaloText(rendered.text)) {
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
    const message = extractZaloMessage(event, { textOnly: false });
    const privateUserMessage =
      String(message?.chat?.chat_type).toLowerCase() === 'private' &&
      message.from?.is_bot !== true;
    if (
      onPrivateMessage &&
      privateUserMessage &&
      typeof message.from?.display_name === 'string' &&
      message.from.display_name.trim()
    ) {
      try {
        await onPrivateMessage({
          userId: String(message.from.id),
          chatId: String(message.chat.id),
          chatType: 'private',
          displayName: message.from.display_name,
        });
      } catch {
        // Profile refresh is optional; never stop a command or log user data.
        try {
          onError(new Error('Zalo subscriber name refresh failed.'));
        } catch {
          /* Diagnostics must not prevent command handling. */
        }
      }
    }
    const explicitContext = toCommandContext(event);
    let greeted = false;
    if (greetingRepository && privateUserMessage) {
      try {
        const claimed = await greetingRepository.claim({
          userId: String(message.from.id),
          chatId: String(message.chat.id),
          chatType: 'private',
        });
        // /start includes the greeting with its full help, so do not send it twice.
        if (claimed && explicitContext?.command !== 'start') {
          const greetingContext =
            explicitContext ||
            createContext(event, { command: 'start', args: [] });
          await sendResult(
            greetingContext,
            createZaloGreetingResult(greetingContext.actor)
          );
          greeted = true;
        }
      } catch {
        try {
          onError(new Error('Zalo greeting failed.'));
        } catch {
          /* Greeting failures must not prevent commands or expose user data. */
        }
      }
    }
    const pending = explicitContext ? null : takeInput(event);
    const context = explicitContext || pending?.context;

    if (!context) {
      return greeted;
    }

    if (explicitContext) {
      clearInput(context);
    }

    const routed = await router.run(context);

    if (!routed.handled) {
      if (pending) {
        pendingInputs.set(pending.key, pending.pending);
      }
      return greeted;
    }

    await sendResult(context, routed.result);
    return true;
  }

  function removeExpiredEvents() {
    const currentTime = now();
    for (const [eventId, expiresAt] of processedEvents) {
      if (expiresAt <= currentTime) processedEvents.delete(eventId);
    }
  }

  async function handleUpdate(update) {
    const message = extractZaloMessage(update, { textOnly: false });

    if (!message) {
      return false;
    }

    const messageId = String(message.message_id ?? '').trim();
    const eventId = messageId ? `${message.chat.id}:${messageId}` : '';

    if (!eventId) {
      return handleEvent(update);
    }

    removeExpiredEvents();

    if (processedEvents.has(eventId)) {
      return true;
    }

    if (inFlightEvents.has(eventId)) {
      return inFlightEvents.get(eventId);
    }

    const task = handleEvent(update)
      .then(handled => {
        processedEvents.set(eventId, now() + eventTtlMs);
        return handled;
      })
      .finally(() => {
        inFlightEvents.delete(eventId);
      });

    inFlightEvents.set(eventId, task);
    return task;
  }

  async function reportError(event, error) {
    onError(error);
    const context = toCommandContext(event);

    if (!context) {
      return;
    }

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
    if (!started) {
      return;
    }

    if (typeof client.removeListener === 'function') {
      client.removeListener('message', eventHandler);
    }

    pendingInputs.clear();
    processedEvents.clear();
    inFlightEvents.clear();
    started = false;
  }

  const adapter = Object.freeze({
    capabilities: ZALO_CAPABILITIES,
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
  ZALO_CAPABILITIES,
  createZaloAdapter,
  parseZaloCommandText,
};
