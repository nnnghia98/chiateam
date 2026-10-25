const bot = require('../telegram-client');
const { logEvent } = require('./logger');

const {
  createTelegramChannelConfig,
  resolveTelegramDestination,
} = require('../../platforms/telegram/channel-routing');
const channelConfig = createTelegramChannelConfig();
const CHAT_ID = channelConfig.chatId;
const THREAD_TYPES = Object.fromEntries(
  Object.entries(channelConfig.threads).map(([key, value]) => [
    key.toUpperCase(),
    value,
  ])
);

logEvent('telegram.config', 'routing loaded', {
  unified: Boolean(channelConfig.routing),
  chat: CHAT_ID,
});

const sendMessage = async ({ msg, type, message, options = {} }) => {
  const { useSourceChat = false, ...providedOptions } = options;
  const context = {
    actor: { externalId: msg.from?.id },
    conversation: {
      externalId: msg.chat.id,
      threadId: msg.message_thread_id,
      type: msg.chat.type,
    },
  };
  const { chatId, threadId } = resolveTelegramDestination(
    channelConfig,
    context,
    useSourceChat && !channelConfig.routing
      ? 'source'
      : String(type || 'default').toLowerCase()
  );
  const baseOptions = { ...providedOptions };
  delete baseOptions.message_thread_id;
  const sendOptions =
    threadId == null
      ? { ...baseOptions }
      : { ...baseOptions, message_thread_id: threadId };

  try {
    return await bot.sendMessage(chatId, message, sendOptions);
  } catch (error) {
    const errorContext = {
      error: error.message,
      chat: chatId,
      thread: threadId,
      type,
      code: error.response?.statusCode,
    };

    // If thread not found or closed, try sending without thread (fallback to main chat)
    const shouldFallback =
      !channelConfig.routing &&
      threadId != null &&
      (error.message?.includes('message thread not found') ||
        error.message?.includes('TOPIC_CLOSED'));

    if (shouldFallback) {
      const reason = error.message?.includes('TOPIC_CLOSED')
        ? 'Topic is closed'
        : 'Thread not found';
      logEvent(
        'telegram.send',
        'retrying without thread',
        { ...errorContext, reason },
        'warn'
      );
      try {
        return await bot.sendMessage(chatId, message, { ...baseOptions });
      } catch (fallbackError) {
        logEvent(
          'telegram.send',
          'fallback failed',
          { ...errorContext, fallbackError: fallbackError.message },
          'error'
        );
        throw fallbackError;
      }
    }

    logEvent('telegram.send', 'message failed', errorContext, 'error');

    // Re-throw other errors
    throw error;
  }
};

module.exports = {
  CHAT_ID,
  THREAD_TYPES,
  sendMessage,
};
