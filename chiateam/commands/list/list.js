const { LIST } = require('../../utils/messages');
const { getChatId } = require('../../utils/chat');

const listCommand = (bot, members) => {
  bot.onText(/^\/list$/, msg => {
    if (members.size === 0) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), LIST.emptyList);
      return;
    }
    const names = Array.from(members.values());
    bot.sendMessage(
      getChatId(msg, 'DEFAULT'),
      LIST.success.replace('{names}', names.join('\n'))
    );
  });
};

module.exports = listCommand;
