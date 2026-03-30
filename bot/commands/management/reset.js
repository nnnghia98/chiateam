const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { RESET } = require('../../utils/messages');

const bot = require('../../bot');

const resetCommand = ({
  members,
  teamA,
  teamB,
  team3A,
  team3B,
  team3C,
  setTiensan,
  setTeamThua,
}) => {
  bot.onText(/^\/reset$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    // Clear all team and bench data
    members.clear();
    teamA.clear();
    teamB.clear();
    team3A.clear();
    team3B.clear();
    team3C.clear();

    // Reset financial data and team thua
    setTiensan(580000);
    setTeamThua(null);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: RESET.success,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = resetCommand;
