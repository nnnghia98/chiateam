const { sendMessage } = require('../../utils/chat');
const bot = require('../../bot');

const startCommand = () => {
  bot.onText(/^\/start$/, msg => {
    sendMessage(
      msg,
      'MAIN',
      `👋 *DANH SÁCH LỆNH HƯỚNG DẪN*

📝 *Quản lý danh sách:*
• \`/addme\` - Tự add vào bench
• \`/add\` - Add hộ vào bench
• \`/remove\` - Xóa khỏi bench
• \`/bench\` - Xem bench
• \`/clearbench\` - Xóa toàn bộ bench

⚽ *Quản lý team:*
• \`/chiateam\` - Chia team
• \`/team\` - Xem team
• \`/addtoteam\` - Thêm vào Home/Away
• \`/resetteam\` - Hủy team
• \`/resetteam1\` - Xóa member từ Team A
• \`/resetteam2\` - Xóa member từ Team B

💰 *Tiền sân:*
• \`/tiensan\` - Thêm tiền sân
• \`/chiatien\` - Chia tiền

🗳 *Vote:*
• \`/taovote\` - Tạo vote
• \`/clearvote\` - Xóa tất cả vote

🏆 *Thống kê:*
• \`/leaderboard\` - Xem bảng xếp hạng
• \`/update-leaderboard\` - Cập nhật thống kê
• \`/player\` - Xem thông số chi tiết
• \`/register\` - Đăng ký cầu thủ mới

💡 Dùng sai cú pháp = ngu!`,
      { parse_mode: 'Markdown' }
    );
  });
};

module.exports = startCommand;
