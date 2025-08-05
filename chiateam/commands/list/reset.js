const { RESET, VALIDATION } = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');

const resetCommand = (bot, members) => {
  bot.onText(/^\/reset$/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, VALIDATION.onlyAdmin);
      return;
    }

    if (members.size === 0) {
      bot.sendMessage(msg.chat.id, RESET.emptyList);
      return;
    }

    members.clear();
    bot.sendMessage(msg.chat.id, RESET.success);
  });
};

module.exports = resetCommand;
