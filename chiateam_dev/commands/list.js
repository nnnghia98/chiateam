const listCommand = (bot, members) => {
  bot.onText(/\/list/, msg => {
    if (members.size === 0) {
      bot.sendMessage(msg.chat.id, '/list trống');
      return;
    }
    const names = Array.from(members.values());
    bot.sendMessage(msg.chat.id, `👥 Danh sách hiện tại:\n${names.join('\n')}`);
  });
};

module.exports = listCommand;
