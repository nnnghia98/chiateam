const bot = require('../telegram-client');

const THREAD_TYPES = {
  DEFAULT: process.env.DEFAULT_THREAD_ID,
  MAIN: process.env.MAIN_THREAD_ID,
  ANNOUNCEMENT: process.env.ANNOUNCEMENT_THREAD_ID,
  VIP: process.env.VIP_THREAD_ID,
  STATISTICS: process.env.STATISTICS_THREAD_ID,
};

const CHAT_ID = process.env.CHAT_ID;

// Debug: Log thread configuration on startup
console.log('📬 Thread configuration:', {
  CHAT_ID,
  THREAD_TYPES,
});

const sendMessage = async ({ msg, type, message, options = {} }) => {
  const chatId = CHAT_ID ?? msg.chat.id;
  const threadId = THREAD_TYPES[type];

  const sendOptions =
    threadId != null
      ? {
          ...options,
          message_thread_id: threadId,
        }
      : options;

  if (type && threadId == null) {
    console.warn(`[chat.sendMessage] Unknown thread type: ${type}`);
  }

  try {
    return await bot.sendMessage(chatId, message, sendOptions);
  } catch (error) {
    // Log error with context for debugging
    console.error('[chat.sendMessage] Failed to send message:', {
      error: error.message,
      chatId,
      threadId,
      type,
      code: error.response?.statusCode,
    });

    // If thread not found or closed, try sending without thread (fallback to main chat)
    const shouldFallback =
      threadId != null &&
      (error.message?.includes('message thread not found') ||
        error.message?.includes('TOPIC_CLOSED'));

    if (shouldFallback) {
      const reason = error.message?.includes('TOPIC_CLOSED')
        ? 'Topic is closed'
        : 'Thread not found';
      console.warn(`[chat.sendMessage] ${reason}, retrying without thread_id`);
      try {
        return await bot.sendMessage(chatId, message, options);
      } catch (fallbackError) {
        console.error(
          '[chat.sendMessage] Fallback also failed:',
          fallbackError.message
        );
        throw fallbackError;
      }
    }

    // Re-throw other errors
    throw error;
  }
};

module.exports = {
  CHAT_ID,
  THREAD_TYPES,
  sendMessage,
};
