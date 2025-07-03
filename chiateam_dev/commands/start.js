const startCommand = bot => {
  bot.onText(/\/start/, msg => {
    bot.sendMessage(
      msg.chat.id,
      '👋 Full lệnh + cú pháp có thể dùng, ko có mà dùng = ngu:\n\n' +
        '• /addme - Thêm mình vào list\n' +
        '• /add + [name 1, name 2, name 3, ...] - Thêm người khác vào list\n' +
        '• /list - Xem danh sách hiện tại\n' +
        '• /chiateam - Chia team\n' +
        '• /team - Xem team đã chia\n' +
        '• /addtoteam1 - Chọn member để thêm vào Team A\n' +
        '• /addtoteam2 - Chọn member để thêm vào Team B\n' +
        '• /remove - Chọn người cút\n' +
        '• /resetteam - Xoá 2 team, trả member về lại list\n' +
        '• /reset - Xóa toàn bộ list (Only admin)\n'
    );
  });
};

module.exports = startCommand;
