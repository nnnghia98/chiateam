const shuffleArray = require('../utils/shuffle');

const splitCommand = (bot, members, lastMembersBeforeSplit, groupA, groupB) => {
  bot.onText(/\/chiateam/, msg => {
    if (members.size < 2 && groupA.length === 0 && groupB.length === 0) {
      bot.sendMessage(msg.chat.id, '❗ Không đủ người để chia');
      return;
    }

    // If teams already exist, add new members to teams
    if (groupA.length > 0 || groupB.length > 0) {
      if (members.size === 0) {
        bot.sendMessage(msg.chat.id, '❗ Không có member mới để thêm vào team');
        return;
      }

      const newNames = Array.from(members.values());
      shuffleArray(newNames);

      // Distribute new members alternately between teams
      newNames.forEach((name, index) => {
        if (index % 2 === 0) {
          groupA.push(name);
        } else {
          groupB.push(name);
        }
      });

      // Clear the main list after adding to teams
      members.clear();

      const message = `🎲 *Thêm member mới vào team* 🎲\n\n👤 *Team A:*\n${groupA.join(
        '\n'
      )}\n\n👤 *Team B:*\n${groupB.join('\n')}`;

      bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      return;
    }

    // First time splitting - create new teams
    lastMembersBeforeSplit = new Map(members); // Backup full list

    const names = Array.from(members.values());
    shuffleArray(names);

    const half = Math.ceil(names.length / 2);
    groupA.length = 0; // Clear array
    groupB.length = 0; // Clear array
    groupA.push(...names.slice(0, half));
    groupB.push(...names.slice(half));

    // Clear the main list after creating teams
    members.clear();

    const message = `🎲 *Chia team* 🎲\n\n👤 *Team A:*\n${groupA.join(
      '\n'
    )}\n\n👤 *Team B:*\n${groupB.join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = splitCommand;
