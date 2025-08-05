const { LIST } = require('../../utils/messages');

const listCommand = (bot, members) => {
  bot.onText(/^\/list$/, msg => {
    if (members.size === 0) {
      bot.sendMessage(msg.chat.id, LIST.emptyList);
      return;
    }
    const names = Array.from(members.values());
    bot.sendMessage(
      msg.chat.id,
      LIST.success.replace('{names}', names.join('\n'))
    );
  });
};

module.exports = listCommand;
