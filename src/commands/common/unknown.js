const { COMMANDS } = require('../../utils/constants');
const { UNKNOWN } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const unknownCommand = () => {
  bot.on('message', msg => {
    if (!msg.text || !msg.text.startsWith('/')) {
      return;
    }

    const command = msg.text.split(' ')[0];

    if (COMMANDS.includes(command)) {
      return;
    }

    const userName = msg.from.first_name || msg.from.username || 'Unknown User';
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: `${userName}: ${UNKNOWN.warning}`,
    });
  });
};

module.exports = unknownCommand;
