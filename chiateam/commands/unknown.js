const { commands } = require('../utils/constants');

const unknownCommand = bot => {
  bot.on('message', msg => {
    if (!msg.text || !msg.text.startsWith('/')) {
      return;
    }

    const command = msg.text.split(' ')[0];

    if (commands.includes(command)) {
      return;
    }

    const userName = msg.from.first_name || msg.from.username || 'Unknown User';
    bot.sendMessage(msg.chat.id, `${userName}: chưa integrate, gọi cái lồn`);
  });
};

module.exports = unknownCommand;
