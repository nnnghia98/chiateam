const { getPlayerStats } = require('../../../api/services/leaderboard-service');
const { PLAYER } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { isOnCooldown } = require('../../utils/cooldown');

const bot = require('../../telegram-client');

const playerCommand = () => {
  bot.onText(/^\/player$/, msg => {
    if (isOnCooldown(msg, '/player')) {
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: PLAYER.usage,
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/player (.+)$/, async (msg, match) => {
    if (isOnCooldown(msg, '/player')) {
      return;
    }

    try {
      const playerId = parseInt(match[1].trim());

      // Validate player ID
      if (isNaN(playerId) || playerId <= 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: PLAYER.invalidNumber,
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
          message: PLAYER.noStats.replace('${playerId}', playerId),
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      sendMessage({
        msg,
        type: 'STATISTICS',
        message: PLAYER.buildStatsMessage({ playerId, playerStats }),
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error fetching player stats:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: PLAYER.fetchError,
      });
    }
  });
};

module.exports = playerCommand;
