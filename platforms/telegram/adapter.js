const {
  createCommandContext,
} = require('../../core/contracts/command-context');
const {
  TELEGRAM_COMMAND_ACTION_PREFIX,
  formatTelegramMessage,
} = require('./formatter');

const DEFAULT_INTERACTION_TTL_MS = 10 * 60 * 1000;

const TELEGRAM_CAPABILITIES = Object.freeze({
  buttons: true,
  messageEditing: false,
  nativePolls: true,
  threads: true,
});

function createTelegramChannelConfig(env = process.env) {
  return Object.freeze({
    chatId: env.CHAT_ID || null,
    threads: Object.freeze({
      default: env.DEFAULT_THREAD_ID || null,
      main: env.MAIN_THREAD_ID || null,
      announcement: env.ANNOUNCEMENT_THREAD_ID || null,
      vip: env.VIP_THREAD_ID || null,
      statistics: env.STATISTICS_THREAD_ID || null,
    }),
  });
}

function getDisplayName(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
}

function parseCommandText(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const parts = text.trim().split(/\s+/);
  const token = parts.shift();

  if (!token || !/^\/[a-z0-9_-]+(?:@[a-z0-9_]+)?$/i.test(token)) {
    return null;
  }

  return {
    command: token.slice(1).split('@')[0],
    args: parts,
  };
}

function parseTelegramCommandAction(data) {
  if (
    typeof data !== 'string' ||
    !data.startsWith(TELEGRAM_COMMAND_ACTION_PREFIX)
  ) {
    return null;
  }

  return parseCommandText(data.slice(TELEGRAM_COMMAND_ACTION_PREFIX.length));
}

function createTelegramAdapter({
  bot,
  router,
  formatter = formatTelegramMessage,
  channelConfig = createTelegramChannelConfig(),
  registerActionHandler,
  interactionTtlMs = DEFAULT_INTERACTION_TTL_MS,
  now = Date.now,
  errorMessage = '❌ Có lỗi xảy ra. Vui lòng thử lại.',
  onError = error => console.error('❌ [telegram.adapter]', error),
} = {}) {
  if (
    !bot ||
    typeof bot.on !== 'function' ||
    typeof bot.sendMessage !== 'function'
  ) {
    throw new TypeError('Telegram adapter requires a bot client.');
  }

  if (!router || typeof router.run !== 'function') {
    throw new TypeError('Telegram adapter requires a command router.');
  }

  if (
    registerActionHandler != null &&
    typeof registerActionHandler !== 'function'
  ) {
    throw new TypeError('Telegram action registrar must be a function.');
  }

  if (!Number.isFinite(interactionTtlMs) || interactionTtlMs <= 0) {
    throw new TypeError('Telegram interaction TTL must be a positive number.');
  }

  if (typeof now !== 'function') {
    throw new TypeError('Telegram adapter clock must be a function.');
  }

  let started = false;
  let unregisterActionHandler = null;
  let usesDirectActionListener = false;
  const pendingInputs = new Map();

  function createContext(event, parsed) {
    if (!parsed || event?.from?.id == null || event?.chat?.id == null) {
      return null;
    }

    return createCommandContext({
      ...parsed,
      actor: {
        platform: 'telegram',
        externalId: event.from.id,
        displayName: getDisplayName(event.from),
        username: event.from.username,
      },
      conversation: {
        externalId: event.chat.id,
        threadId: event.message_thread_id,
      },
    });
  }

  function toCommandContext(event) {
    return createContext(event, parseCommandText(event?.text));
  }

  function getInteractionKey({ actor, conversation }) {
    return [
      actor.externalId,
      conversation.externalId,
      conversation.threadId ?? '',
    ].join(':');
  }

  function rememberInput(context, input) {
    if (!input) {
      return;
    }

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
    const text = String(event?.text ?? '').trim();

    if (!text || text.startsWith('/')) {
      return null;
    }

    const baseContext = createContext(event, {
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
      const options = { ...rendered.options };
      const hasConfiguredChannel = Object.prototype.hasOwnProperty.call(
        channelConfig.threads || {},
        message.channel
      );
      const useSource = message.channel === 'source' || !hasConfiguredChannel;
      const chatId = useSource
        ? context.conversation.externalId
        : channelConfig.chatId || context.conversation.externalId;
      const threadId = useSource
        ? context.conversation.threadId
        : channelConfig.threads?.[message.channel];

      if (threadId != null) {
        options.message_thread_id = threadId;
      }

      try {
        await bot.sendMessage(chatId, rendered.text, options);
      } catch (error) {
        const shouldRetryWithoutThread =
          threadId != null &&
          (error.message?.includes('message thread not found') ||
            error.message?.includes('TOPIC_CLOSED'));

        if (!shouldRetryWithoutThread) {
          throw error;
        }

        const fallbackOptions = { ...options };
        delete fallbackOptions.message_thread_id;
        await bot.sendMessage(chatId, rendered.text, fallbackOptions);
      }

      rememberInput(context, message.input);
    }
  }

  async function handleEvent(event) {
    const explicitContext = toCommandContext(event);
    const pending = explicitContext ? null : takeInput(event);
    const context = explicitContext || pending?.context;

    if (!context) {
      return false;
    }

    if (explicitContext) {
      clearInput(context);
    }

    const routed = await router.run(context);

    if (!routed.handled) {
      if (pending) {
        pendingInputs.set(pending.key, pending.pending);
      }
      return false;
    }

    await sendResult(context, routed.result);
    return true;
  }

  async function handleAction(query) {
    const parsed = parseTelegramCommandAction(query?.data);
    const context = createContext(
      {
        ...query?.message,
        text: query?.data?.slice(TELEGRAM_COMMAND_ACTION_PREFIX.length),
        from: query?.from,
      },
      parsed
    );

    if (!context) {
      return false;
    }

    clearInput(context);
    const routed = await router.run(context);

    if (!routed.handled) {
      return false;
    }

    if (typeof bot.answerCallbackQuery === 'function' && query?.id != null) {
      try {
        await bot.answerCallbackQuery(query.id, {
          text: '',
          show_alert: false,
        });
      } catch (error) {
        onError(error);
      }
    }

    await sendResult(context, routed.result);
    return true;
  }

  async function reportError(event, error) {
    onError(error);
    const context = toCommandContext(event);

    if (!context) {
      return;
    }

    try {
      await bot.sendMessage(context.conversation.externalId, errorMessage, {
        ...(context.conversation.threadId != null
          ? { message_thread_id: context.conversation.threadId }
          : {}),
      });
    } catch (sendError) {
      onError(sendError);
    }
  }

  const eventHandler = event => {
    void handleEvent(event).catch(error => reportError(event, error));
  };

  const actionEventHandler = query => {
    void handleAction(query).catch(onError);
  };

  function start() {
    if (!started) {
      if (registerActionHandler) {
        unregisterActionHandler = registerActionHandler(handleAction) || null;
      } else {
        bot.on('callback_query', actionEventHandler);
        usesDirectActionListener = true;
      }

      bot.on('message', eventHandler);
      started = true;
    }

    return adapter;
  }

  function stop() {
    if (!started) {
      return;
    }

    if (typeof bot.removeListener === 'function') {
      bot.removeListener('message', eventHandler);

      if (usesDirectActionListener) {
        bot.removeListener('callback_query', actionEventHandler);
      }
    }

    if (typeof unregisterActionHandler === 'function') {
      unregisterActionHandler();
    }

    pendingInputs.clear();
    unregisterActionHandler = null;
    usesDirectActionListener = false;
    started = false;
  }

  const adapter = Object.freeze({
    capabilities: TELEGRAM_CAPABILITIES,
    toCommandContext,
    sendResult,
    handleEvent,
    handleAction,
    start,
    stop,
  });

  return adapter;
}

module.exports = {
  TELEGRAM_CAPABILITIES,
  createTelegramChannelConfig,
  createTelegramAdapter,
  parseCommandText,
  parseTelegramCommandAction,
};
