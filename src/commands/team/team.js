const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const teamsCommand = ({ teamA, teamB, team3A, team3B, team3C }) => {
  // Show 2-team view (HOME / AWAY)
  bot.onText(/^\/team$/, msg => {
    if (teamA.size === 0 && teamB.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '⚠️ Chưa có team nào được chia. Dùng /chiateam trước',
      });
      return;
    }

    const message =
      `🎲 *Team hiện tại* 🎲\n\n` +
      `👤 *HOME:*\n${Array.from(teamA.values()).map(getDisplayName).join('\n')}\n\n` +
      `👤 *AWAY:*\n${Array.from(teamB.values()).map(getDisplayName).join('\n')}`;

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });

  // Show 3-team view (HOME / AWAY / EXTRA)
  bot.onText(/^\/team 3$/, msg => {
    if (team3A.size === 0 && team3B.size === 0 && team3C.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '⚠️ Chưa có 3 team nào được chia. Dùng /chiateam 3 để chia 3 team',
      });
      return;
    }

    const message =
      `🎲 *3 Team hiện tại* 🎲\n\n` +
      `👤 *HOME:*\n${Array.from(team3A.values()).map(getDisplayName).join('\n') || '(trống)'}\n\n` +
      `👤 *AWAY:*\n${Array.from(team3B.values()).map(getDisplayName).join('\n') || '(trống)'}\n\n` +
      `👤 *EXTRA:*\n${Array.from(team3C.values()).map(getDisplayName).join('\n') || '(trống)'}`;

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = teamsCommand;
