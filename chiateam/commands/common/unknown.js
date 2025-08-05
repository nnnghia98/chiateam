const { COMMANDS } = require('../../utils/constants');
const { UNKNOWN } = require('../../utils/messages');
const { getChatId } = require('../../utils/chat');

const unknownCommand = bot => {
  bot.on('message', msg => {
    if (!msg.text || !msg.text.startsWith('/')) {
      return;
    }

    const command = msg.text.split(' ')[0];

    if (COMMANDS.includes(command)) {
      return;
    }

    const userName = msg.from.first_name || msg.from.username || 'Unknown User';
    bot.sendMessage(
      getChatId(msg, 'DEFAULT'),
      `${userName}: ${UNKNOWN.warning}`
    );
  });
};

module.exports = unknownCommand;
