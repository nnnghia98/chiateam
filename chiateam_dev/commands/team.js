const teamsCommand = (bot, teamA, teamB) => {
  bot.onText(/\/team/, msg => {
    if (teamA.length === 0 && teamB.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Chưa có team nào được chia. Dùng /chiateam trước'
      );
      return;
    }

    const message = `🎲 *Team hiện tại* 🎲\n\n👤 *Team A:*\n${teamA.join(
      '\n'
    )}\n\n👤 *Team B:*\n${teamB.join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = teamsCommand;
