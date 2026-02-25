const { getPlayerStats } = require('../../services/leaderboard-service');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const playerCommand = () => {
  bot.onText(/^\/player$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message:
        '📝 **Cách sử dụng lệnh player:**\n\n' +
        '�� **Cú pháp:**\n' +
        '`/player [player_no]`\n\n' +
        '**Ví dụ:**\n' +
        '`/player 1001`\n' +
        '`/player 12345`\n\n' +
        '💡 **Lưu ý:**\n' +
        '• Số áo phải là số nguyên dương\n' +
        '• Player phải có dữ liệu thống kê để xem được\n' +
        '• Sử dụng `/update-leaderboard` để thêm dữ liệu\n' +
        '• Sử dụng `/update-leaderboard GOAL/ASSIST` để cập nhật bàn thắng/kiến tạo',
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/player (.+)$/, async (msg, match) => {
    try {
      const playerId = parseInt(match[1].trim());

      // Validate player ID
      if (isNaN(playerId) || playerId <= 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message:
            '❌ **Số áo không hợp lệ!**\n\n' +
            '�� **Cách sử dụng:**\n' +
            '`/player [player_no]`\n\n' +
            '**Ví dụ:**\n' +
            '`/player 1001`\n' +
            '`/player 12345`',
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      // Get player stats
      const playerStats = await getPlayerStats(playerId);

      if (!playerStats) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message:
            '❌ **Không tìm thấy thông số của player số áo: ${playerId}**\n\n' +
            '�� Player này chưa có dữ liệu thống kê nào.\n' +
            'Sử dụng `/update-leaderboard` để thêm dữ liệu cho player này.',
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      // Calculate additional stats
      const winratePercent = (playerStats.winrate * 100).toFixed(1);
      const totalGames = playerStats.total_match;
      const totalWins = playerStats.total_win;
      const totalLosses = playerStats.total_lose;
      const totalDraws = playerStats.total_draw || 0;
      const totalGoals = playerStats.goal || 0;
      const totalAssists = playerStats.assist || 0;

      // Calculate win/loss ratio
      const winLossRatio =
        totalLosses > 0
          ? (totalWins / totalLosses).toFixed(2)
          : totalWins > 0
            ? '∞'
            : '0.00';

      // Determine rank emoji based on performance
      const rankEmoji = totalWins > 0 ? '🏆' : totalGames > 0 ? '📊' : '👤';

      // Create detailed stats message
      let message = `${rankEmoji} **THÔNG SỐ PLAYER** ${rankEmoji}\n\n`;
      message += `🆔 **Player số áo:** ${playerId}\n`;
      message += `📅 **Ngày tạo:** ${new Date(playerStats.created_at).toLocaleDateString('vi-VN')}\n`;
      message += `🔄 **Cập nhật lần cuối:** ${new Date(playerStats.updated_at).toLocaleDateString('vi-VN')}\n\n`;

      message += '📊 **THỐNG KÊ CHI TIẾT:**\n';
      message += `   • 🎮 **Tổng trận:** ${totalGames}\n`;
      message += `   • ✅ **Thắng:** ${totalWins}\n`;
      message += `   • ❌ **Thua:** ${totalLosses}\n`;
      message += `   • 🤝 **Hòa:** ${totalDraws}\n`;
      message += `   • ⚽ **Bàn thắng:** ${totalGoals}\n`;
      message += `   • 🎯 **Kiến tạo:** ${totalAssists}\n`;
      message += `   • 🎯 **Tỷ lệ thắng:** ${winratePercent}%\n`;
      message += `   • ⚖️ **Tỷ lệ W/L:** ${winLossRatio}\n\n`;

      // Add performance analysis
      if (totalGames > 0) {
        const winPercentage = ((totalWins / totalGames) * 100).toFixed(1);
        let performance = '';

        if (winPercentage >= 80) {
          performance = '🔥 **Xuất sắc** - Player rất mạnh!';
        } else if (winPercentage >= 60) {
          performance = '⭐ **Tốt** - Player có kỹ năng tốt';
        } else if (winPercentage >= 40) {
          performance = '📉 **Trung bình** - Cần cải thiện thêm';
        } else {
          performance = '📉 **Cần cải thiện** - Nên luyện tập thêm';
        }

        message += `📈 **ĐÁNH GIÁ:**\n${performance}\n\n`;
      }

      // Add footer with commands
      message += '💡 **Lệnh liên quan:**\n';
      message += '• `/leaderboard` - Xem bảng xếp hạng\n';
      message +=
        '• `/update-leaderboard WIN/LOSE/DRAW [id1,id2,id3]` - Cập nhật thống kê\n';
      message +=
        '• `/update-leaderboard GOAL player_number value` - Cập nhật bàn thắng\n';
      message +=
        '• `/update-leaderboard ASSIST player_number value` - Cập nhật kiến tạo';

      sendMessage({
        msg,
        type: 'STATISTICS',
        message,
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error fetching player stats:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '❌ Có lỗi xảy ra khi tải thông số player. Vui lòng thử lại sau.',
      });
    }
  });
};

module.exports = playerCommand;
