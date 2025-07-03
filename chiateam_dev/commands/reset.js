const { isAdmin } = require('../utils/validate');

const resetCommand = (bot, members) => {
  bot.onText(/\/reset/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền reset list.');
      return;
    }

    if (members.size === 0) {
      bot.sendMessage(msg.chat.id, '📝 /list trống');
      return;
    }

    members.clear();
    bot.sendMessage(msg.chat.id, '✅ /list đã được xóa');
  });
};

module.exports = resetCommand;
