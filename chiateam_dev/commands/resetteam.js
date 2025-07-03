const { isAdmin } = require('../utils/validate');

const resetTeamCommand = (bot, groupA, groupB) => {
  bot.onText(/\/resetteam/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền reset team.');
      return;
    }

    if (groupA.length === 0 && groupB.length === 0) {
      bot.sendMessage(msg.chat.id, '📝 Không có team nào để xóa.');
      return;
    }

    groupA.length = 0;
    groupB.length = 0;
    bot.sendMessage(msg.chat.id, '✅ Đã xóa toàn bộ team.');
  });
};

module.exports = resetTeamCommand;
