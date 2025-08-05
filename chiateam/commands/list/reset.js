const { RESET, VALIDATION } = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');
const { getChatId } = require('../../utils/chat');

const resetCommand = (bot, members) => {
  bot.onText(/^\/reset$/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), VALIDATION.onlyAdmin);
      return;
    }

    if (members.size === 0) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), RESET.emptyList);
      return;
    }

    members.clear();
    bot.sendMessage(getChatId(msg, 'DEFAULT'), RESET.success);
  });
};

module.exports = resetCommand;
