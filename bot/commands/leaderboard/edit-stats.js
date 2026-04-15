const { EDIT_STATS } = require('../../utils/messages');
const {
  upsertTotals,
  getPlayerStats,
} = require('../../../api/services/leaderboard-service');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');

const bot = require('../../telegram-client');

const editStatsCommand = () => {
  // Handle command with parameters
  bot.onText(/^\/edit-stats (.+)$/, async (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }
    try {
      const args = match[1].trim();

      // Parse the command: player_id total_match total_win total_lose
      const parts = args.split(' ');

      if (parts.length !== 5) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.invalidSyntax,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      const playerId = parseInt(parts[0]);
      const totalMatch = parseInt(parts[1]);
      const totalWin = parseInt(parts[2]);
      const totalLose = parseInt(parts[3]);
      const totalDraw = parseInt(parts[4]);

      // Validate player ID
      if (isNaN(playerId) || playerId <= 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.invalidPlayerId,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      // Validate match statistics
      if (isNaN(totalMatch) || totalMatch < 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.invalidTotalMatch,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      if (isNaN(totalWin) || totalWin < 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.invalidTotalWin,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      if (isNaN(totalLose) || totalLose < 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.invalidTotalLose,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      if (isNaN(totalDraw) || totalDraw < 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.invalidTotalDraw,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      // Validate logic: total_match = total_win + total_lose + total_draw
      if (totalMatch !== totalWin + totalLose + totalDraw) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: EDIT_STATS.buildInvalidTotalsMessage({
            totalMatch,
            totalWin,
            totalLose,
            totalDraw,
          }),
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      // Get current stats for comparison
      const currentStats = await getPlayerStats(playerId);

      await upsertTotals(playerId, totalMatch, totalWin, totalLose, totalDraw);

      sendMessage({
        msg,
        type: 'STATISTICS',
        message: EDIT_STATS.buildSuccessMessage({
          playerId,
          currentStats,
          totalMatch,
          totalWin,
          totalLose,
          totalDraw,
        }),
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error editing stats:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_STATS.error,
      });
    }
  });

  // Handle command without parameters
  bot.onText(/^\/edit-stats$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: EDIT_STATS.usage,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = editStatsCommand;
