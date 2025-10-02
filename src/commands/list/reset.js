const { RESET, VALIDATION } = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const resetCommand = members => {
  bot.onText(/^\/clearlist$/, msg => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    if (members.size === 0) {
      sendMessage(msg, 'DEFAULT', RESET.emptyList);
      return;
    }

    members.clear();
    sendMessage(msg, 'DEFAULT', RESET.success);
  });
};

module.exports = resetCommand;
