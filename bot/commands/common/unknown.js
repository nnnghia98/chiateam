const { UNKNOWN } = require('../../utils/messages');
const { isSupportedCommandText } = require('../../utils/command-filter');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../telegram-client');

const unknownCommand = () => {
  bot.on('message', msg => {
    if (!msg.text || !msg.text.startsWith('/')) {
      return;
    }

    if (isSupportedCommandText(msg.text)) {
      return;
    }

    const userName = msg.from.first_name || msg.from.username || 'Unknown User';
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: UNKNOWN.buildWarning(userName),
    });
  });
};

module.exports = unknownCommand;
