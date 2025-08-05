function getChatId(msg, type) {
  switch (type) {
    case 'DEFAULT':
      return process.env.DEFAULT_CHAT_ID || msg.chat.id;
    case 'MAIN':
      return process.env.MAIN_CHAT_ID || msg.chat.id;
    case 'ANNOUNCEMENT':
      return process.env.ANNOUNCEMENT_CHAT_ID || msg.chat.id;
    case 'VIP':
      return process.env.VIP_CHAT_ID || msg.chat.id;
    case 'STATISTICS':
      return process.env.STATISTICS_CHAT_ID || msg.chat.id;
    default:
      return null;
  }
}

module.exports = {
  getChatId,
};
