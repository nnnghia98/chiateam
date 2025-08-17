const { isAdmin } = require('../../utils/validate');
const { RESET_TEAM, VALIDATION } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const resetTeamCommand = (members, teamA, teamB) => {
  bot.onText(/^\/resetteam$/, msg => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    if (teamA.size === 0 && teamB.size === 0) {
      sendMessage(msg, 'DEFAULT', RESET_TEAM.emptyList);
      return;
    }

    const allTeamMembers = [...teamA.values(), ...teamB.values()];
    let restoredCount = 0;

    allTeamMembers.forEach((name, index) => {
      const fakeId = Date.now() + Math.random() + index;
      members.set(fakeId, name);
      restoredCount++;
    });

    teamA.clear();
    teamB.clear();

    sendMessage(msg, 'DEFAULT', RESET_TEAM.success);
  });
};

module.exports = resetTeamCommand;
