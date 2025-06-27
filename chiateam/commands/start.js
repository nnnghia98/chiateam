const startCommand = bot => {
  bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, '👋 Hê lô! /addme để tự thêm mình vào /list');
  });
};

module.exports = startCommand;
