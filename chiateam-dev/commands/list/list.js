const { LIST } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const listCommand = members => {
  bot.onText(/^\/list$/, msg => {
    if (members.size === 0) {
      sendMessage(msg, 'DEFAULT', LIST.emptyList);
      return;
    }
    const names = Array.from(members.values());
    sendMessage(
      msg,
      'DEFAULT',
      LIST.success.replace('{names}', names.join('\n'))
    );
  });
};

module.exports = listCommand;
