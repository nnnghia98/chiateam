const startCommand = bot => {
  bot.onText(/\/start/, msg => {
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '➕ Thêm tôi', callback_data: 'addme' },
          { text: '👥 Danh sách', callback_data: 'list' },
        ],
        [
          { text: '🎲 Chia team', callback_data: 'split' },
          { text: '🔄 Khôi phục', callback_data: 'unsplit' },
        ],
        [{ text: '🗑 Xóa list', callback_data: 'reset' }],
      ],
    };

    bot.sendMessage(
      msg.chat.id,
      '👋 Hê lô! Chọn một tùy chọn bên dưới hoặc dùng lệnh:\n\n' +
        '• /addme - Thêm mình vào list\n' +
        '• /list - Xem danh sách hiện tại\n' +
        '• /split - Chia team\n' +
        '• /unsplit - Khôi phục list trước khi chia\n' +
        '• /reset - Xóa toàn bộ list',
      { reply_markup: inlineKeyboard }
    );
  });
};

module.exports = startCommand;
