const menuCommand = bot => {
  bot.onText(/\/menu/, msg => {
    bot.sendMessage(msg.chat.id, '🎮 *Menu chính*', {
      parse_mode: 'Markdown',
    });
  });
};

module.exports = menuCommand;
