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
        '• /reset - Xóa toàn bộ list (Only admin)\n' +
        '• /tiensan + số tiền - Thêm tiền sân\n' +
        '• /chiatien - Chia tiền\n' +
        '• /vote - Tạo vote\n' +
        '• /clearvote - Xóa tất cả vote\n' +
        '• /leaderboard - Xem bảng xếp hạng\n' +
        '• /update-leaderboard WIN/LOSE [id1,id2,id3] - Cập nhật thống kê\n' +
        '• /resetteam2 - Xoá member từ Team B\n' +
        '• /player-stats [player_id] - Xem thông số chi tiết player\n'
    );
  });
};

module.exports = startCommand;
