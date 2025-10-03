const { RESET, VALIDATION } = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const clearBenchCommand = ({ members }) => {
  bot.onText(/^\/clearbench$/, msg => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    if (members.size === 0) {
      sendMessage(msg, 'DEFAULT', RESET.emptyBench);
      return;
    }

    members.clear();
    sendMessage(msg, 'DEFAULT', RESET.success);
  });
};

module.exports = clearBenchCommand;
