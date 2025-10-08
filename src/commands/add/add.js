const { isValidName, isDuplicateName } = require('../../utils/validate');
const { ADD } = require('../../utils/messages');
const { PATTERNS } = require('../../utils/constants');

const bot = require('../../bot');
const { sendMessage } = require('../../utils/chat');

const addCommand = ({ members }) => {
  bot.onText(PATTERNS.add, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: ADD.instruction,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(PATTERNS.add_list, (msg, match) => {
    const rawNames = match[1];
    const namesToAdd = rawNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n);

    if (namesToAdd.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD.warning,
        options: {
          parse_mode: 'Markdown',
        },
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
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: `${ADD.invalidNames} ${invalidNames.join(', ')}`,
      });

      return;
    }

    if (addedCount === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD.noNewMembers,
      });
    } else {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD.success.replace('${addedCount}', addedCount),
      });
    }
  });
};

module.exports = addCommand;
