const shuffleArray = require('../utils/shuffle');

const splitCommand = (bot, members, lastMembersBeforeSplit, groupA, groupB) => {
  bot.onText(/\/split/, msg => {
    if (members.size < 2) {
      bot.sendMessage(msg.chat.id, '❗ Không đủ người để chia');
      return;
    }

    lastMembersBeforeSplit = new Map(members); // Backup full list

    const names = Array.from(members.values());
    shuffleArray(names);

    const half = Math.ceil(names.length / 2);
    groupA.length = 0; // Clear array
    groupB.length = 0; // Clear array
    groupA.push(...names.slice(0, half));
    groupB.push(...names.slice(half));

    const message = `🎲 *Chia team* 🎲\n\n👤 *Team A:*\n${groupA.join(
      '\n'
    )}\n\n👤 *Team B:*\n${groupB.join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

    members.clear(); // Clear list after split
  });
};

module.exports = splitCommand;
