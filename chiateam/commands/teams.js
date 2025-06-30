const teamsCommand = (bot, groupA, groupB) => {
  bot.onText(/\/teams/, msg => {
    if (groupA.length === 0 && groupB.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Chưa có team nào được chia. Dùng /chiateam trước'
      );
      return;
    }

    const message = `🎲 *Teams hiện tại* 🎲\n\n👤 *Team A:*\n${groupA.join(
      '\n'
    )}\n\n👤 *Team B:*\n${groupB.join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = teamsCommand;
