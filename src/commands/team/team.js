const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const teamsCommand = ({ teamA, teamB }) => {
  bot.onText(/^\/team$/, msg => {
    if (teamA.size === 0 && teamB.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '⚠️ Chưa có team nào được chia. Dùng /chiateam trước',
      });
      return;
    }

    const message = `🎲 *Team hiện tại* 🎲\n\n👤 *HOME:*\n${Array.from(teamA.values())
      .map(getDisplayName)
      .join('\n')}\n\n👤 *AWAY:*\n${Array.from(teamB.values())
      .map(getDisplayName)
      .join('\n')}`;

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = teamsCommand;
