const bot = require('../bot');

const THREAD_TYPES = {
  DEFAULT: process.env.DEFAULT_THREAD_ID,
  MAIN: process.env.MAIN_THREAD_ID,
  ANNOUNCEMENT: process.env.ANNOUNCEMENT_THREAD_ID,
  VIP: process.env.VIP_THREAD_ID,
  STATISTICS: process.env.STATISTICS_THREAD_ID,
};

const CHAT_ID = process.env.CHAT_ID;

const sendMessage = ({ msg, type = 'DEFAULT', message, options = {} }) => {
  const chatId = CHAT_ID ?? msg.chat.id;
  const threadId = THREAD_TYPES[type];

  return bot.sendMessage(chatId, message, {
    ...options,
    message_thread_id: threadId,
  });
};

module.exports = {
  CHAT_ID,
  THREAD_TYPES,
  sendMessage,
};
