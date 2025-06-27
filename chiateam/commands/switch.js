const shuffleArray = require('../utils/shuffle');

const switchCommand = (bot, groupA, groupB) => {
  bot.onText(/\/switch\s*\[(.+)\]/, (msg, match) => {
    if (groupA.length === 0 || groupB.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Không có team nào để chia. Dùng /split trước'
      );
      return;
    }

    const rawNames = match[1];
    const namesToSwitch = rawNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n);

    if (namesToSwitch.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Nhập list member để chuyển. Ví dụ:\n`/switch [Nghia, Nghia 1]`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Check all names exist in Group A
    for (const name of namesToSwitch) {
      if (!groupA.some(n => n.toLowerCase() === name.toLowerCase())) {
        bot.sendMessage(msg.chat.id, `⚠️ ${name} không có trong Team A.`);
        return;
      }
    }

    if (groupB.length < namesToSwitch.length) {
      bot.sendMessage(msg.chat.id, '⚠️ Không đủ người trong Team B để chuyển');
      return;
    }

    // Remove members from Group A
    const newGroupA = groupA.filter(
      n => !namesToSwitch.some(s => s.toLowerCase() === n.toLowerCase())
    );

    // Randomly select members from Group B
    const shuffledB = [...groupB];
    shuffleArray(shuffledB);
    const pickedFromB = shuffledB.slice(0, namesToSwitch.length);

    // Remove picked members from Group B
    const newGroupB = groupB.filter(n => !pickedFromB.includes(n));

    // Perform the swap
    groupA.length = 0;
    groupB.length = 0;
    groupA.push(...newGroupA, ...pickedFromB);
    groupB.push(...newGroupB, ...namesToSwitch);

    // Show new groups
    const message = `🔄 *Team sau khi chuyển* 🔄\n\n👤 *Team A:*\n${groupA.join(
      '\n'
    )}\n\n👤 *Team B:*\n${groupB.join('\n')}`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = switchCommand;
