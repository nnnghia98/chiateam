const shuffleArray = require('../../utils/shuffle');
const { isAdmin } = require('../../utils/validate');

const splitCommand = (bot, members, teamA, teamB) => {
  bot.onText(/\/chiateam/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền chia team.');
      return;
    }

    if (members.size < 2 && teamA.size === 0 && teamB.size === 0) {
      bot.sendMessage(msg.chat.id, '❗ Không đủ người để chia');
      return;
    }

    // If teams already exist, add new members to teams
    if (teamA.size > 0 || teamB.size > 0) {
      if (members.size === 0) {
        bot.sendMessage(msg.chat.id, '❗ Không có member mới để thêm vào team');
        return;
      }

      const newNames = Array.from(members.values());
      shuffleArray(newNames);

      // Add new members to the team with fewer members
      newNames.forEach((name, index) => {
        const fakeId = Date.now() + Math.random() + index;
        if (teamA.size <= teamB.size) {
          teamA.set(fakeId, name);
        } else {
          teamB.set(fakeId, name);
        }
      });

      // Clear the main list after adding to teams
      members.clear();

      const message = `🎲 *Thêm member mới vào team* 🎲\n\n👤 *Team A:*\n${Array.from(
        teamA.values()
      ).join('\n')}\n\n👤 *Team B:*\n${Array.from(teamB.values()).join('\n')}`;

      bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      return;
    }

    const names = Array.from(members.values());
    shuffleArray(names);

    const half = Math.ceil(names.length / 2);
    teamA.clear();
    teamB.clear();
    names.slice(0, half).forEach((name, idx) => {
      const fakeId = Date.now() + Math.random() + idx;
      teamA.set(fakeId, name);
    });
    names.slice(half).forEach((name, idx) => {
      const fakeId = Date.now() + Math.random() + half + idx;
      teamB.set(fakeId, name);
    });

    // Clear the main list after creating teams
    members.clear();

    const message = `🎲 *Chia team* 🎲\n\n👤 *Team A:*\n${Array.from(
      teamA.values()
    ).join('\n')}\n\n👤 *Team B:*\n${Array.from(teamB.values()).join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = splitCommand;
