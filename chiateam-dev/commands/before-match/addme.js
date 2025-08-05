const { isValidName, isDuplicateName } = require('../../utils/validate');
const { ADD_ME } = require('../../utils/messages');
const { PATTERNS } = require('../../utils/constants');
const { getChatId } = require('../../utils/chat');

const addMeCommand = (bot, members) => {
  bot.onText(PATTERNS.add_me, msg => {
    const userId = msg.from.id;
    const name =
      msg.from.first_name +
      (msg.from.username ? ` (@${msg.from.username})` : '');

    if (!isValidName(msg.from.first_name)) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), ADD_ME.warning);
      return;
    }

    const allNames = Array.from(members.values());
    if (isDuplicateName(msg.from.first_name, allNames)) {
      bot.sendMessage(
        getChatId(msg, 'DEFAULT'),
        ADD_ME.duplicate.replace('${name}', msg.from.first_name)
      );
      return;
    }

    members.set(userId, name);
    bot.sendMessage(
      getChatId(msg, 'MAIN'),
      ADD_ME.success.replace('${name}', name)
    );
  });
};

module.exports = addMeCommand;
