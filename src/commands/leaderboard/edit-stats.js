const {
  updatePlayerStatsDirect,
  getPlayerStats,
} = require('../../db/leaderboard');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const editStatsCommand = () => {
  // Handle command with parameters
  bot.onText(/^\/edit-stats (.+)$/, async (msg, match) => {
    try {
      const args = match[1].trim();

      // Parse the command: player_id total_match total_win total_lose
      const parts = args.split(' ');

      if (parts.length !== 5) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Cú pháp không đúng!**\n\n' +
            '�� **Cách sử dụng:**\n' +
            '`/edit-stats player_id total_match total_win total_lose total_draw`\n\n' +
            '**Ví dụ:**\n' +
            '`/edit-stats 1001 10 7 2 1`\n' +
            '`/edit-stats 1002 5 2 2 1`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const playerId = parseInt(parts[0]);
      const totalMatch = parseInt(parts[1]);
      const totalWin = parseInt(parts[2]);
      const totalLose = parseInt(parts[3]);
      const totalDraw = parseInt(parts[4]);

      // Validate player ID
      if (isNaN(playerId) || playerId <= 0) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **ID người chơi không hợp lệ!**\n\n' +
            '�� **Lưu ý:** ID phải là số nguyên dương',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Validate match statistics
      if (isNaN(totalMatch) || totalMatch < 0) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Số trận đấu không hợp lệ!**\n\n' +
            '�� **Lưu ý:** Số trận phải là số nguyên không âm',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (isNaN(totalWin) || totalWin < 0) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Số trận thắng không hợp lệ!**\n\n' +
            '�� **Lưu ý:** Số trận thắng phải là số nguyên không âm',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (isNaN(totalLose) || totalLose < 0) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Số trận thua không hợp lệ!**\n\n' +
            '�� **Lưu ý:** Số trận thua phải là số nguyên không âm',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (isNaN(totalDraw) || totalDraw < 0) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Số trận hòa không hợp lệ!**\n\n' +
            '📝 **Lưu ý:** Số trận hòa phải là số nguyên không âm',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Validate logic: total_match = total_win + total_lose + total_draw
      if (totalMatch !== totalWin + totalLose + totalDraw) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Dữ liệu không hợp lệ!**\n\n' +
            '📝 **Lưu ý:** Tổng số trận = Số trận thắng + Số trận thua + Số trận hòa\n\n' +
            '📊 **Dữ liệu hiện tại:**\n' +
            `   • Tổng trận: ${totalMatch}\n` +
            `   • Thắng: ${totalWin}\n` +
            `   • Thua: ${totalLose}\n` +
            `   • Hòa: ${totalDraw}\n` +
            `   • Tổng: ${totalWin + totalLose + totalDraw}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Get current stats for comparison
      const currentStats = await getPlayerStats(playerId);
      const winrate =
        totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;
      const winratePercent = (winrate * 100).toFixed(1);

      // Update player statistics
      await updatePlayerStatsDirect(
        playerId,
        totalMatch,
        totalWin,
        totalLose,
        totalDraw
      );

      // Create response message
      let message = '✏️ **CHỈNH SỬA THỐNG KÊ** ✏️\n\n';
      message += `🆔 **ID người chơi:** ${playerId}\n\n`;

      if (currentStats) {
        message += '📊 **Thống kê cũ:**\n';
        message += `   • Trận: ${currentStats.total_match} | Thắng: ${currentStats.total_win} | Thua: ${currentStats.total_lose} | Hòa: ${currentStats.total_draw || 0}\n`;
        message += `   • Winrate: ${(currentStats.winrate * 100).toFixed(1)}%\n\n`;
      }

      message += '📊 **Thống kê mới:**\n';
      message += `   • Trận: ${totalMatch} | Thắng: ${totalWin} | Thua: ${totalLose} | Hòa: ${totalDraw}\n`;
      message += `   • Winrate: ${winratePercent}%\n\n`;

      if (currentStats) {
        const matchDiff = totalMatch - currentStats.total_match;
        const winDiff = totalWin - currentStats.total_win;
        const loseDiff = totalLose - currentStats.total_lose;
        const drawDiff = totalDraw - (currentStats.total_draw || 0);

        message += '📈 **Thay đổi:**\n';
        message += `   • Trận: ${matchDiff > 0 ? '+' : ''}${matchDiff}\n`;
        message += `   • Thắng: ${winDiff > 0 ? '+' : ''}${winDiff}\n`;
        message += `   • Thua: ${loseDiff > 0 ? '+' : ''}${loseDiff}\n`;
        message += `   • Hòa: ${drawDiff > 0 ? '+' : ''}${drawDiff}\n\n`;
      }

      message += '💡 Sử dụng `/leaderboard` để xem bảng xếp hạng mới';

      sendMessage({
        msg,
        type: 'STATISTICS',
        message: message,
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error editing stats:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message:
          '❌ Có lỗi xảy ra khi chỉnh sửa thống kê. Vui lòng thử lại sau.',
      });
    }
  });

  // Handle command without parameters
  bot.onText(/^\/edit-stats$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message:
        '📝 **Cách sử dụng lệnh edit-stats:**\n\n' +
        '📝 **Cú pháp:**\n' +
        '`/edit-stats player_id total_match total_win total_lose total_draw`\n\n' +
        '**Ví dụ:**\n' +
        '`/edit-stats 1001 10 7 2 1` - 10 trận, 7 thắng, 2 thua, 1 hòa\n' +
        '`/edit-stats 1002 5 2 2 1` - 5 trận, 2 thắng, 2 thua, 1 hòa\n\n' +
        '📝 **Lưu ý:**\n' +
        '• Tổng số trận = Số trận thắng + Số trận thua + Số trận hòa\n' +
        '• Tất cả số liệu phải là số nguyên không âm\n' +
        '• Winrate sẽ được tính tự động',
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = editStatsCommand;
