const teamsCommand = (bot, teamA, teamB) => {
  bot.onText(/^\/team$/, msg => {
    if (teamA.size === 0 && teamB.size === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Chưa có team nào được chia. Dùng /chiateam trước'
      );
      return;
    }

    const message = `🎲 *Team hiện tại* 🎲\n\n👤 *Team A:*\n${Array.from(
      teamA.values()
    ).join('\n')}\n\n👤 *Team B:*\n${Array.from(teamB.values()).join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = teamsCommand;
