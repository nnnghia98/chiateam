const { isValidName, isDuplicateName } = require('../utils/validate');

const addMeCommand = (bot, members) => {
  bot.onText(/\/addme/, msg => {
    const userId = msg.from.id;
    const name =
      msg.from.first_name +
      (msg.from.username ? ` (@${msg.from.username})` : '');

    if (!isValidName(msg.from.first_name)) {
      bot.sendMessage(msg.chat.id, '⚠️ Tên không hợp lệ.');
      return;
    }

    // Check for duplicate name (case-insensitive)
    const allNames = Array.from(members.values());
    if (isDuplicateName(msg.from.first_name, allNames)) {
      bot.sendMessage(
        msg.chat.id,
        `⚠️ Đã có tên ${msg.from.first_name} trong list.`
      );
      return;
    }

    if (members.has(userId)) {
      bot.sendMessage(msg.chat.id, `⚠️ Có ${name} rồi`);
      return;
    }

    members.set(userId, name);
    bot.sendMessage(msg.chat.id, `✅ ${name} đã được thêm vào /list`);
  });
};

module.exports = addMeCommand;
