const { isValidName, isDuplicateName } = require('../../utils/validate');
const { ADD } = require('./messages');
const { PATTERNS } = require('./constants');

const addListCommand = (bot, members) => {
  bot.onText(PATTERNS.add, msg => {
    bot.sendMessage(msg.chat.id, ADD.instruction, { parse_mode: 'Markdown' });
  });

  bot.onText(PATTERNS.add_list, (msg, match) => {
    const rawNames = match[1];
    const namesToAdd = rawNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n);

    if (namesToAdd.length === 0) {
      bot.sendMessage(msg.chat.id, ADD.warning, { parse_mode: 'Markdown' });
      return;
    }

    const allNames = Array.from(members.values());
    let addedCount = 0;
    const invalidNames = [];
    namesToAdd.forEach(name => {
      if (!isValidName(name)) {
        invalidNames.push(name);
        return;
      }
      if (!isDuplicateName(name, allNames)) {
        const fakeId = Date.now() + Math.random();
        members.set(fakeId, name);
        allNames.push(name);
        addedCount++;
      }
    });

    if (invalidNames.length > 0) {
      bot.sendMessage(
        msg.chat.id,
        `${ADD.invalidNames} ${invalidNames.join(', ')}`
      );

      return;
    }

    if (addedCount === 0) {
      bot.sendMessage(msg.chat.id, ADD.noNewMembers);
    } else {
      bot.sendMessage(
        msg.chat.id,
        ADD.success.replace('${addedCount}', addedCount)
      );
    }
  });
};

module.exports = addListCommand;
