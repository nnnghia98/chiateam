const startCommand = bot => {
  bot.onText(/^\/start$/, msg => {
    bot.sendMessage(
      msg.chat.id,
      `👋 *DANH SÁCH LỆNH HƯỚNG DẪN*

📝 *Quản lý danh sách:*
• \`/addme\` - Tự add vào list
• \`/add\` - Add hộ vào list
• \`/remove\` - Xóa khỏi list
• \`/list\` - Xem list
• \`/reset\` - Xóa toàn bộ list

⚽ *Quản lý team:*
• \`/chiateam\` - Chia team
• \`/team\` - Xem team
• \`/addtoteam1\` - Thêm vào Team A
• \`/addtoteam2\` - Thêm vào Team B
• \`/resetteam\` - Hủy team
• \`/resetteam1\` - Xóa member từ Team A
• \`/resetteam2\` - Xóa member từ Team B

💰 *Tiền sân:*
• \`/tiensan\` - Thêm tiền sân
• \`/chiatien\` - Chia tiền

🗳 *Vote:*
• \`/vote\` - Tạo vote
• \`/clearvote\` - Xóa tất cả vote

🏆 *Thống kê:*
• \`/leaderboard\` - Xem bảng xếp hạng
• \`/update-leaderboard\` - Cập nhật thống kê
• \`/player-stats\` - Xem thông số chi tiết

💡 Dùng sai cú pháp = ngu!`,
      { parse_mode: 'Markdown' }
    );
  });
};

module.exports = startCommand;
