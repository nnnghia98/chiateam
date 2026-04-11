const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { RESET } = require('../../utils/messages');

const bot = require('../../telegram-client');

const resetCommand = ({ resetAll }) => {
  bot.onText(/^\/reset$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    // Reset all data in one batch operation
    resetAll();

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
