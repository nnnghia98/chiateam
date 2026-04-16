const { getAllPlayers } = require('../../../api/routes/players');
const { getMultiplePlayerStats } = require('../../../api/routes/leaderboard');
const { sendMessage } = require('../../utils/chat');
const { isOnCooldown } = require('../../utils/cooldown');
const { PLAYERS } = require('../../utils/messages');

const bot = require('../../telegram-client');

const playersCommand = () => {
  bot.onText(/^\/players$/, async msg => {
    if (isOnCooldown(msg, '/players')) {
      return;
    }

    try {
      const players = await getAllPlayers();

      if (players.length === 0) {
        sendMessage({
          msg,
          type: 'STATISTICS',
          message: PLAYERS.empty,
          options: { parse_mode: 'Markdown' },
        });
        return;
      }

      const playerNumbers = players.map(p => p.number);
      const statsRows = await getMultiplePlayerStats(playerNumbers);
      const statsByNumber = {};
      (statsRows || []).forEach(row => {
        statsByNumber[row.player_number] = row;
      });

      sendMessage({
        msg,
        type: 'STATISTICS',
        message: PLAYERS.buildList(players, statsByNumber),
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (err) {
      console.error('Error fetching players:', err);
      sendMessage({
        msg,
        type: 'STATISTICS',
        message: PLAYERS.error,
        options: { parse_mode: 'Markdown' },
      });
    }
  });
};

module.exports = playersCommand;
