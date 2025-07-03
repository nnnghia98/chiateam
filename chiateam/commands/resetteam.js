const { isAdmin } = require('../utils/validate');

const resetTeamCommand = (bot, members, groupA, groupB) => {
  bot.onText(/\/resetteam/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền reset team.');
      return;
    }

    if (groupA.length === 0 && groupB.length === 0) {
      bot.sendMessage(msg.chat.id, '📝 Không có team nào để xóa.');
      return;
    }

    // Restore all members from both teams back to the main list
    const allTeamMembers = [...groupA, ...groupB];
    let restoredCount = 0;

    allTeamMembers.forEach((name, index) => {
      // Generate a unique ID for each restored member
      const fakeId = Date.now() + Math.random() + index;
      members.set(fakeId, name);
      restoredCount++;
    });

    // Clear both teams
    groupA.length = 0;
    groupB.length = 0;

    bot.sendMessage(
      msg.chat.id,
      `✅ Đã xóa toàn bộ team và khôi phục ${restoredCount} member về /list`
    );
  });
};

module.exports = resetTeamCommand;
