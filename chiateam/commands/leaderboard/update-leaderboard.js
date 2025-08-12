const { updatePlayerStats } = require('../../db/leaderboard');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const updateLeaderboardCommand = () => {
  // Handle command with parameters
  bot.onText(/\/update-leaderboard (.+)/, async (msg, match) => {
    try {
      const args = match[1].trim();

      // Parse the command: WIN/LOSE [id1,id2,id3]
      const parts = args.split(' ');

      if (parts.length < 2) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Cú pháp không đúng!**\n\n' +
            '📝 **Cách sử dụng:**\n' +
            '`/update-leaderboard WIN [id1,id2,id3]`\n' +
            '`/update-leaderboard LOSE [id1,id2,id3]`\n\n' +
            '**Ví dụ:**\n' +
            '`/update-leaderboard WIN [1001,1002,1003]`\n' +
            '`/update-leaderboard LOSE [1004,1005]`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const result = parts[0].toUpperCase();
      const playerIdsString = parts.slice(1).join(' ');

      // Validate result - chỉ chấp nhận WIN hoặc LOSE
      if (result !== 'WIN' && result !== 'LOSE') {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Kết quả không hợp lệ!**\n\n' +
            '📝 **Chỉ chấp nhận:**\n' +
            '• `WIN` - Cập nhật thắng\n' +
            '• `LOSE` - Cập nhật thua\n\n' +
            '📝 **Ví dụ đúng:**\n' +
            '`/update-leaderboard WIN [1001,1002,1003]`\n' +
            '`/update-leaderboard LOSE [1004,1005]`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Parse player IDs from the array format [id1,id2,id3]
      let playerIds = [];

      // Try to parse as array format [id1,id2,id3]
      const arrayMatch = playerIdsString.match(/\[([^\]]+)\]/);
      if (arrayMatch) {
        const idsString = arrayMatch[1];
        playerIds = idsString
          .split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id));
      } else {
        // Try to parse as space-separated IDs
        playerIds = playerIdsString
          .split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id));
      }

      if (playerIds.length === 0) {
        sendMessage(
          msg,
          'DEFAULT',
          '❌ **Không tìm thấy ID người chơi hợp lệ!**\n\n' +
            '📝 **Ví dụ đúng:**\n' +
            '`/update-leaderboard WIN [1001,1002,1003]`\n' +
            '`/update-leaderboard LOSE [1004,1005]`\n\n' +
            '📝 **Lưu ý:** ID phải là số nguyên hợp lệ',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Validate player IDs - kiểm tra ID có hợp lệ không
      const invalidIds = playerIds.filter(id => id <= 0);
      if (invalidIds.length > 0) {
        sendMessage(
          msg,
          'DEFAULT',
          `❌ **ID người chơi không hợp lệ:** ${invalidIds.join(', ')}\n\n` +
            '📝 **Lưu ý:** ID phải là số nguyên dương',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Update player statistics
      await updatePlayerStats(playerIds, result);

      // Create response message
      const resultEmoji = result === 'WIN' ? '✅' : '❌';
      const resultText = result === 'WIN' ? 'THẮNG' : 'THUA';

      let message = `${resultEmoji} **CẬP NHẬT THỐNG KÊ** ${resultEmoji}\n\n`;
      message += `🎯 **Kết quả:** ${resultText}\n`;
      message += `👥 **Số người chơi:** ${playerIds.length}\n`;
      message += `🆔 **ID người chơi:** ${playerIds.join(', ')}\n\n`;

      // Update statistics for each player
      message += '📊 **Thay đổi thống kê:**\n';
      playerIds.forEach(playerId => {
        message += `   • ID ${playerId}: +1 trận, +1 ${result === 'WIN' ? 'thắng' : 'thua'}\n`;
      });

      message += '\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng mới';

      sendMessage(msg, 'STATISTICS', message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      sendMessage(
        msg,
        'DEFAULT',
        '❌ Có lỗi xảy ra khi cập nhật thống kê. Vui lòng thử lại sau.'
      );
    }
  });

  // Handle command without parameters
  bot.onText(/^\/update-leaderboard$/, msg => {
    sendMessage(
      msg,
      'DEFAULT',
      '📝 **Cách sử dụng lệnh update-leaderboard:**\n\n' +
        '📝 **Cú pháp:**\n' +
        '`/update-leaderboard WIN [id1,id2,id3]` - Cập nhật thắng\n' +
        '`/update-leaderboard LOSE [id1,id2,id3]` - Cập nhật thua\n\n' +
        '**Ví dụ:**\n' +
        '`/update-leaderboard WIN [1001,1002,1003]`\n' +
        '`/update-leaderboard LOSE [1004,1005]`\n\n' +
        '💡 Sử dụng `/leaderboard` để xem bảng xếp hạng',
      { parse_mode: 'Markdown' }
    );
  });
};

module.exports = updateLeaderboardCommand;
