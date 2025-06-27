const resetCommand = (bot, members) => {
  bot.onText(/\/reset/, msg => {
    if (members.size === 0) {
      bot.sendMessage(msg.chat.id, '📝 /list trống');
      return;
    }

    members.clear();
    bot.sendMessage(msg.chat.id, '✅ /list đã được xóa');
  });
};

module.exports = resetCommand;
