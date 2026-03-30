const { isValidName, isDuplicateName } = require('../../utils/validate');
const { toEntry, getDisplayName } = require('../../utils/team-member');
const { ADD_ME } = require('../../utils/messages');
const { PATTERNS } = require('../../utils/constants');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const addMeCommand = ({ members }) => {
  bot.onText(PATTERNS.add_me, msg => {
    const userId = msg.from.id;
    const name =
      msg.from.first_name +
      (msg.from.username ? ` (@${msg.from.username})` : '');

    if (!isValidName(msg.from.first_name)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_ME.warning,
      });
      return;
    }

    // Check if user already added (by userId if exists, or by name)
    if (members.has(userId)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_ME.duplicate.replace('${name}', msg.from.first_name),
      });
      return;
    }

    // Check for duplicate first names (extract first name from display name)
    const allNames = Array.from(members.values()).map(member => {
      const displayName = getDisplayName(member);
      // Extract first name before @ symbol if present
      return displayName.split(' (@')[0].trim();
    });

    if (isDuplicateName(msg.from.first_name, allNames)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_ME.duplicate.replace('${name}', msg.from.first_name),
      });
      return;
    }

    members.set(userId, toEntry(name, userId));
    sendMessage({
      msg,
      type: 'MAIN',
      message: ADD_ME.success.replace('${name}', name),
    });
  });
};

module.exports = addMeCommand;
