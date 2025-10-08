const {
  updatePlayerStats,
  updatePlayerGoal,
  updatePlayerAssist,
} = require('../../db/leaderboard');
const { sendMessage } = require('../../utils/chat');
const { UPDATE_LEADERBOARD } = require('../../utils/messages');

const bot = require('../../bot');

const updateLeaderboardCommand = () => {
  // Handle command with parameters
  bot.onText(/\/update-leaderboard (.+)/, async (msg, match) => {
    try {
      const args = match[1].trim();

      // Parse the command: WIN/LOSE/DRAW [id1,id2,id3] or GOAL/ASSIST player_number value
      const parts = args.split(' ');

      if (parts.length < 2) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: UPDATE_LEADERBOARD.invalidSyntax,
          options: {
            parse_mode: 'Markdown',
          },
        });
        return;
      }

      const result = parts[0].toUpperCase();
      const playerIdsString = parts.slice(1).join(' ');

      // Handle GOAL and ASSIST cases
      if (result === 'GOAL' || result === 'ASSIST') {
        if (parts.length !== 3) {
          const message = UPDATE_LEADERBOARD.invalidGoalAssistSyntax.replace(
            '{result}',
            result
          );
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: message,
            options: { parse_mode: 'Markdown' },
          });
          return;
        }

        const playerNumber = parseInt(parts[1]);
        const value = parseInt(parts[2]);

        if (isNaN(playerNumber) || playerNumber <= 0) {
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: UPDATE_LEADERBOARD.invalidPlayerNumber,
            options: {
              parse_mode: 'Markdown',
            },
          });
          return;
        }

        if (isNaN(value)) {
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: UPDATE_LEADERBOARD.invalidValue,
            options: {
              parse_mode: 'Markdown',
            },
          });
          return;
        }

        try {
          if (result === 'GOAL') {
            await updatePlayerGoal(playerNumber, value);
          } else {
            await updatePlayerAssist(playerNumber, value);
          }

          const valueText = value >= 0 ? `+${value}` : value.toString();
          let message;

          if (result === 'GOAL') {
            message = UPDATE_LEADERBOARD.goalUpdateSuccess
              .replace('{playerNumber}', playerNumber)
              .replace('{valueText}', valueText);
          } else {
            message = UPDATE_LEADERBOARD.assistUpdateSuccess
              .replace('{playerNumber}', playerNumber)
              .replace('{valueText}', valueText);
          }

          sendMessage({
            msg,
            type: 'STATISTICS',
            message: message,
            options: {
              parse_mode: 'Markdown',
            },
          });
        } catch (error) {
          console.error(`Error updating ${result.toLowerCase()}:`, error);
          const errorMessage =
            result === 'GOAL'
              ? UPDATE_LEADERBOARD.goalUpdateError
              : UPDATE_LEADERBOARD.assistUpdateError;
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: errorMessage,
          });
        }
        return;
      }

      // Validate result - chỉ chấp nhận WIN, LOSE hoặc DRAW
      if (result !== 'WIN' && result !== 'LOSE' && result !== 'DRAW') {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: UPDATE_LEADERBOARD.invalidResult,
          options: {
            parse_mode: 'Markdown',
          },
        });
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
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: UPDATE_LEADERBOARD.noValidPlayerIds,
          options: {
            parse_mode: 'Markdown',
          },
        });
        return;
      }

      // Validate player IDs - kiểm tra ID có hợp lệ không
      const invalidIds = playerIds.filter(id => id <= 0);
      if (invalidIds.length > 0) {
        const message = UPDATE_LEADERBOARD.invalidPlayerIds.replace(
          '{invalidIds}',
          invalidIds.join(', ')
        );
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: message,
          options: {
            parse_mode: 'Markdown',
          },
        });
        return;
      }

      // Update player statistics
      await updatePlayerStats(playerIds, result);

      // Create response message
      const resultEmoji =
        result === 'WIN' ? '✅' : result === 'LOSE' ? '❌' : '🤝';
      const resultText =
        result === 'WIN' ? 'THẮNG' : result === 'LOSE' ? 'THUA' : 'HÒA';

      let message = `${resultEmoji} **CẬP NHẬT THỐNG KÊ** ${resultEmoji}\n\n`;
      message += `🎯 **Kết quả:** ${resultText}\n`;
      message += `👥 **Số người chơi:** ${playerIds.length}\n`;
      message += `🆔 **ID người chơi:** ${playerIds.join(', ')}\n\n`;

      // Update statistics for each player
      message += '📊 **Thay đổi thống kê:**\n';
      playerIds.forEach(playerId => {
        let statChange = '';
        if (result === 'WIN') {
          statChange = '+1 thắng';
        } else if (result === 'LOSE') {
          statChange = '+1 thua';
        } else {
          statChange = '+1 hòa';
        }
        message += `   • ID ${playerId}: +1 trận, ${statChange}\n`;
      });

      message += '\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng mới';

      sendMessage({
        msg,
        type: 'STATISTICS',
        message: message,
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: UPDATE_LEADERBOARD.updateError,
      });
    }
  });

  // Handle command without parameters
  bot.onText(/^\/update-leaderboard$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: UPDATE_LEADERBOARD.updateUsage,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = updateLeaderboardCommand;
