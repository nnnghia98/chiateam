const { isAdmin } = require('../../utils/validate');
const { REMOVE, VALIDATION } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const removeCommand = members => {
  bot.onText(/^\/remove$/, msg => {
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      sendMessage(msg, 'DEFAULT', REMOVE.emptyList);
      return;
    }

    const numberedList = allNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = REMOVE.instruction.replace('{numberedList}', numberedList);
    sendMessage(msg, 'DEFAULT', message, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(/^\/remove (.+)$/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    const selection = match[1].trim();
    const allNames = Array.from(members.values());
    if (allNames.length === 0) {
      sendMessage(msg, 'DEFAULT', REMOVE.emptyList);
      return;
    }

    let selectedIndices = [];
    if (selection.toLowerCase() === 'all') {
      selectedIndices = allNames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(num => parseInt(num.trim()));
          if (
            !isNaN(start) &&
            !isNaN(end) &&
            start > 0 &&
            end <= allNames.length &&
            start <= end
          ) {
            for (let i = start - 1; i < end; i++) {
              if (!selectedIndices.includes(i)) {
                selectedIndices.push(i);
              }
            }
          }
        } else {
          const num = parseInt(part);
          if (!isNaN(num) && num > 0 && num <= allNames.length) {
            const index = num - 1;
            if (!selectedIndices.includes(index)) {
              selectedIndices.push(index);
            }
          }
        }
      }
    }
    if (selectedIndices.length === 0) {
      sendMessage(msg, 'DEFAULT', REMOVE.invalidSelection, {
        parse_mode: 'Markdown',
      });
      return;
    }
    selectedIndices.sort((a, b) => b - a);
    const removedNames = [];
    for (const index of selectedIndices) {
      const name = allNames[index];
      for (const [userId, memberName] of members) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          members.delete(userId);
          removedNames.push(name);
          break;
        }
      }
    }
    if (removedNames.length === 0) {
      sendMessage(msg, 'DEFAULT', REMOVE.noRemovedMembers);
      return;
    }
    const message = REMOVE.success
      .replace('{count}', removedNames.length)
      .replace('{removedNames}', removedNames.join('\n'));
    sendMessage(msg, 'DEFAULT', message, {
      parse_mode: 'Markdown',
    });
  });
};

module.exports = removeCommand;
