const { getLeaderboard } = require('../../db/leaderboard');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const leaderboardCommand = () => {
  bot.onText(/^\/leaderboard$/, async msg => {
    try {
      const leaderboard = await getLeaderboard();

      if (leaderboard.length === 0) {
        sendMessage(
          msg,
          'STATISTICS',
          '📊 Bảng xếp hạng trống. Chưa có dữ liệu thống kê nào.'
        );
        return;
      }

      let message = '🏆 **BẢNG XẾP HẠNG** 🏆\n\n';
      message += '📈 Sắp xếp theo tỷ lệ thắng (Winrate)\n\n';

      leaderboard.forEach((player, index) => {
        const rank = index + 1;
        const medal =
          rank === 1
            ? '🥇'
            : rank === 2
              ? '🥈'
              : rank === 3
                ? '🥉'
                : `${rank}.`;
        const winratePercent = (player.winrate * 100).toFixed(1);

        message += `${medal} **ID: ${player.player_number}**\n`;
        message += `   📊 Trận: ${player.total_match} | Thắng: ${player.total_win} | Thua: ${player.total_lose} | Hòa: ${player.total_draw || 0}\n`;
        message += `   ⚽ Bàn thắng: ${player.goal || 0} | 🎯 Kiến tạo: ${player.assist || 0}\n`;
        message += `   🎯 Winrate: ${winratePercent}%\n\n`;
      });

      // Add footer with updated commands
      message +=
        '💡 Sử dụng `/update-leaderboard WIN/LOSE/DRAW [id1,id2,id3]` để cập nhật thống kê\n';
      message +=
        '💡 Sử dụng `/update-leaderboard GOAL player_number value` để cập nhật bàn thắng\n';
      message +=
        '💡 Sử dụng `/update-leaderboard ASSIST player_number value` để cập nhật kiến tạo';

      sendMessage(msg, 'STATISTICS', message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      sendMessage(
        msg,
        'STATISTICS',
        '❌ Có lỗi xảy ra khi tải bảng xếp hạng. Vui lòng thử lại sau.'
      );
    }
  });
};

module.exports = leaderboardCommand;
