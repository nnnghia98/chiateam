const { getLeaderboard } = require('../../db/leaderboard');

const leaderboardCommand = bot => {
  bot.onText(/\/leaderboard/, async (msg) => {
    try {
      const leaderboard = await getLeaderboard();
      
      if (leaderboard.length === 0) {
        bot.sendMessage(
          msg.chat.id,
          '📊 Bảng xếp hạng trống. Chưa có dữ liệu thống kê nào.'
        );
        return;
      }

      let message = '🏆 **BẢNG XẾP HẠNG** 🏆\n\n';
      message += '📈 Sắp xếp theo tỷ lệ thắng (Winrate)\n\n';
      
      leaderboard.forEach((player, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const winratePercent = (player.winrate * 100).toFixed(1);
        
        message += `${medal} **ID: ${player.player_id}**\n`;
        message += `   📊 Trận: ${player.total_match} | Thắng: ${player.total_win} | Thua: ${player.total_lose}\n`;
        message += `   🎯 Winrate: ${winratePercent}%\n\n`;
      });

      // Add footer
      message += '💡 Sử dụng `/update-leaderboard WIN/LOSE [id1,id2,id3]` để cập nhật thống kê';

      bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      bot.sendMessage(
        msg.chat.id,
        '❌ Có lỗi xảy ra khi tải bảng xếp hạng. Vui lòng thử lại sau.'
      );
    }
  });
};

module.exports = leaderboardCommand; 