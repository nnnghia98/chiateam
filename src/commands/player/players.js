const { getAllPlayers } = require('../../api/players');
const { getMultiplePlayerStats } = require('../../api/leaderboard');
const { sendMessage } = require('../../utils/chat');
const { PLAYERS } = require('../../utils/messages');

const bot = require('../../bot');

const playersCommand = () => {
  bot.onText(/^\/players$/, async msg => {
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

      let message = PLAYERS.header + '\n\n';

      players.forEach((player, index) => {
        const stats = statsByNumber[player.number] || {};
        const totalMatch = stats.total_match ?? 0;
        const totalWin = stats.total_win ?? 0;
        const totalLose = stats.total_lose ?? 0;
        const totalDraw = stats.total_draw ?? 0;
        const goal = stats.goal ?? 0;
        const assist = stats.assist ?? 0;
        const winrate = stats.winrate != null ? (stats.winrate * 100).toFixed(1) : '0.0';

        message += `**${index + 1}. ${player.name}** (#${player.number})\n`;
        message += `   📊 Trận: ${totalMatch} | Thắng: ${totalWin} | Thua: ${totalLose} | Hòa: ${totalDraw}\n`;
        message += `   ⚽ ${goal} bàn | 🎯 ${assist} KT | Winrate: ${winrate}%\n\n`;
      });

      sendMessage({
        msg,
        type: 'STATISTICS',
        message,
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
