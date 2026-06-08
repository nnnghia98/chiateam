const bot = require('../telegram-client');
const { logEvent } = require('./logger');

const THREAD_TYPES = {
  DEFAULT: process.env.DEFAULT_THREAD_ID,
  MAIN: process.env.MAIN_THREAD_ID,
  ANNOUNCEMENT: process.env.ANNOUNCEMENT_THREAD_ID,
  VIP: process.env.VIP_THREAD_ID,
  STATISTICS: process.env.STATISTICS_THREAD_ID,
};

const CHAT_ID = process.env.CHAT_ID;

logEvent('telegram.config', 'threads loaded', {
  chat: CHAT_ID,
  default: THREAD_TYPES.DEFAULT,
  main: THREAD_TYPES.MAIN,
  announcement: THREAD_TYPES.ANNOUNCEMENT,
  vip: THREAD_TYPES.VIP,
  statistics: THREAD_TYPES.STATISTICS,
});

const sendMessage = async ({ msg, type, message, options = {} }) => {
  const { useSourceChat = false, ...baseOptions } = options;
  const chatId = useSourceChat ? msg.chat.id : CHAT_ID ?? msg.chat.id;
  const threadId = useSourceChat ? msg.message_thread_id : THREAD_TYPES[type];

  const sendOptions =
    threadId != null
      ? {
          ...baseOptions,
          message_thread_id: threadId,
        }
      : baseOptions;

  if (!useSourceChat && type && threadId == null) {
    logEvent(
      'telegram.send',
      'unknown thread type',
      { type, chat: chatId },
      'warn'
    );
  }

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
