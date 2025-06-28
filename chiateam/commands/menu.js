const menuCommand = bot => {
  bot.onText(/\/menu/, msg => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Thêm mình', callback_data: 'addme' },
          { text: '📋 Danh sách', callback_data: 'list' },
        ],
        [
          { text: '🎲 Chia team', callback_data: 'split' },
          { text: '👥 Teams', callback_data: 'teams' },
        ],
        [
          { text: '🗑️ Xóa list', callback_data: 'reset' },
          { text: '↩️ Khôi phục', callback_data: 'unsplit' },
        ],
      ],
    };

    bot.sendMessage(msg.chat.id, '🎮 *Menu chính*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });
};

module.exports = menuCommand;
