const addMeCommand = (bot, members) => {
  bot.onText(/\/addme/, msg => {
    const userId = msg.from.id;
    const name =
      msg.from.first_name +
      (msg.from.username ? ` (@${msg.from.username})` : '');

    if (members.has(userId)) {
      bot.sendMessage(msg.chat.id, `⚠️ Có ${name} rồi`);
      return;
    }

    members.set(userId, name);
    bot.sendMessage(msg.chat.id, `✅ ${name} đã được thêm vào /list`);
  });
};

module.exports = addMeCommand;
