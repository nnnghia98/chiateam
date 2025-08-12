const bot = require('../bot');

function getThreadId(msg, type) {
  switch (type) {
    case 'DEFAULT':
      return process.env.DEFAULT_CHAT_ID;
    case 'MAIN':
      return process.env.MAIN_CHAT_ID;
    case 'ANNOUNCEMENT':
      return process.env.ANNOUNCEMENT_CHAT_ID;
    case 'VIP':
      return process.env.VIP_CHAT_ID;
    case 'STATISTICS':
      return process.env.STATISTICS_CHAT_ID;
    default:
      return msg.message_thread_id;
  }
}

function getChatId(msg) {
  return process.env.CHAT_ID || msg.chat.id;
}

const sendMessage = (msg, type, message, options) => {
  const chatId = getChatId(msg);
  const threadId = getThreadId(msg, type);

  return bot.sendMessage(chatId, message, {
    ...options,
    message_thread_id: threadId,
  });
};

module.exports = {
  getChatId,
  sendMessage,
};
