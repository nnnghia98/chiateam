const { sendMessage } = require('../../utils/chat');
const bot = require('../../bot');

const startCommand = () => {
  bot.onText(/^\/start$/, msg => {
    sendMessage({
      msg,
      type: 'MAIN',
      message: `👋 *DANH SÁCH LỆNH HƯỚNG DẪN*

📝 *Quản lý danh sách:*
• \`/addme\` - Tự add vào bench
• \`/add\` - Add hộ vào bench
• \`/bench\` - Xem bench
• \`/clearbench\` - Xóa member khỏi bench

⚽ *Quản lý team:*
• \`/chiateam\` - Chia 2 team (HOME / AWAY)
• \`/chiateam 3\` - Chia 3 team (HOME / AWAY / EXTRA) (admin)
• \`/team\` - Xem 2 team
• \`/team 3\` - Xem 3 team
• \`/addtoteam\` - Thêm vào HOME / AWAY / EXTRA
• \`/clearteam\` - Xóa member khỏi team

📅 *Trận đấu:*
• \`/match\` - Xem trận tuần này
• \`/match SAVE\` - Lưu trận từ dữ liệu hiện tại
• \`/match dd/mm/yyyy\` - Xem trận theo ngày
• \`/match dd/mm/yyyy DELETE\` - Xóa trận (chỉ admin)
• \`/matches\` - Danh sách trận đấu gần đây

💰 *Tiền sân:*
• \`/tiensan\` - Thêm tiền sân
• \`/chiatien\` - Chia tiền

🗳 *Vote:*
• \`/taovote\` - Tạo vote
• \`/clearvote\` - Xóa tất cả vote

🏆 *Thống kê:*
• \`/leaderboard\` - Xem bảng xếp hạng
• \`/players\` - Danh sách cầu thủ & thống kê
• \`/update-leaderboard\` - Cập nhật thống kê
• \`/player\` - Xem thông số chi tiết

💡 Dùng sai cú pháp = ngu!`,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = startCommand;
