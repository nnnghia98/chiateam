const startCommand = bot => {
  bot.onText(/\/start/, msg => {
    bot.sendMessage(
      msg.chat.id,
      '👋 Full lệnh + cú pháp có thể dùng, ko có mà dùng = ngu:\n\n' +
        '• /addme - Thêm mình vào list\n' +
        '• /addlist + [name 1, name 2, name 3, ...] -Thêm người khác vào list\n' +
        '• /list - Xem danh sách hiện tại\n' +
        '• /chiateam - Chia team\n' +
        '• /remove + [name 1, name 2] - Cho cút\n' +
        '• /reset - Xóa toàn bộ list'
    );
  });
};

module.exports = startCommand;
