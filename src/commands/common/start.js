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
• \`/chiateam\` - Chia team
• \`/team\` - Xem team
• \`/addtoteam\` - Thêm vào Home/Away
• \`/clearteam\` - Xóa member khỏi team

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

💡 Dùng sai cú pháp = ngu!`,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = startCommand;
