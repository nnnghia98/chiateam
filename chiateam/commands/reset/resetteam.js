const { isAdmin } = require('../../utils/validate');

const resetTeamCommand = (bot, members, teamA, teamB) => {
  bot.onText(/\/resetteam/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền reset team.');
      return;
    }

    if (teamA.size === 0 && teamB.size === 0) {
      bot.sendMessage(msg.chat.id, '📝 Không có team nào để xóa.');
      return;
    }

    // Restore all members from both teams back to the main list
    const allTeamMembers = [...teamA.values(), ...teamB.values()];
    let restoredCount = 0;

    allTeamMembers.forEach((name, index) => {
      const fakeId = Date.now() + Math.random() + index;
      members.set(fakeId, name);
      restoredCount++;
    });

    // Clear both teams
    teamA.clear();
    teamB.clear();

    bot.sendMessage(
      msg.chat.id,
      '✅ Đã xóa toàn bộ team và chuyển member về danh sách chính.'
    );
  });
};

module.exports = resetTeamCommand;
