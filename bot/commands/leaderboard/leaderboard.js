const {
  getLeaderboardForDisplay,
} = require('../../../api/services/leaderboard-service');
const { LEADERBOARD } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../telegram-client');

const leaderboardCommand = () => {
  bot.onText(/^\/leaderboard$/, async msg => {
    try {
      const leaderboard = await getLeaderboardForDisplay();

      if (leaderboard.length === 0) {
        sendMessage({
          msg,
          type: 'STATISTICS',
          message: LEADERBOARD.empty,
        });
        return;
      }

      sendMessage({
        msg,
        type: 'STATISTICS',
        message: LEADERBOARD.buildMessage(leaderboard),
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      sendMessage({
        msg,
        type: 'STATISTICS',
        message: LEADERBOARD.error,
      });
    }
  });
};

module.exports = leaderboardCommand;
