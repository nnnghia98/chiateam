const { isValidName, isDuplicateName } = require('../../utils/validate');
const { ADD } = require('../../utils/messages');
const { PATTERNS } = require('../../utils/constants');

const bot = require('../../bot');
const { sendMessage } = require('../../utils/chat');

const addListCommand = members => {
  bot.onText(PATTERNS.add, msg => {
    sendMessage(msg, 'DEFAULT', ADD.instruction, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(PATTERNS.add_list, (msg, match) => {
    const rawNames = match[1];
    const namesToAdd = rawNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n);

    if (namesToAdd.length === 0) {
      sendMessage(msg, 'DEFAULT', ADD.warning, {
        parse_mode: 'Markdown',
      });
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
      sendMessage(
        msg,
        'DEFAULT',
        `${ADD.invalidNames} ${invalidNames.join(', ')}`
      );

      return;
    }

    if (addedCount === 0) {
      sendMessage(msg, 'DEFAULT', ADD.noNewMembers);
    } else {
      sendMessage(
        msg,
        'DEFAULT',
        ADD.success.replace('${addedCount}', addedCount)
      );
    }
  });
};

module.exports = addListCommand;
