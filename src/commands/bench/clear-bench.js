const { RESET, REMOVE, VALIDATION } = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const clearBenchCommand = ({ members }) => {
  bot.onText(/^\/clearbench$/, msg => {
    // if (!isAdmin(msg.from.id)) {
    //   sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
    //   return;
    // }

    // if (members.size === 0) {
    //   sendMessage(msg, 'DEFAULT', RESET.emptyBench);
    //   return;
    // }

    // members.clear();
    // sendMessage(msg, 'DEFAULT', RESET.success);
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      sendMessage(msg, 'DEFAULT', REMOVE.emptyBench);
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

  bot.onText(/^\/clearbench (.+)$/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    if (members.size === 0) {
      sendMessage(msg, 'DEFAULT', RESET.emptyBench);
      return;
    }

    const selection = match[1].trim();
    const allNames = Array.from(members.values());

    // Handle clear all
    if (selection.toLowerCase() === 'all') {
      members.clear();
      sendMessage(msg, 'DEFAULT', RESET.success);
      return;
    }

    // Parse selections similar to remove.js (supports comma and ranges like 1-3)
    const selectedIndices = [];
    const parts = selection.split(',').map(part => part.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [startRaw, endRaw] = part.split('-');
        const start = parseInt(startRaw.trim());
        const end = parseInt(endRaw.trim());
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

    if (selectedIndices.length === 0) {
      const invalidMsg = REMOVE.invalidSelection.replaceAll(
        '/remove',
        '/clearbench'
      );
      sendMessage(msg, 'DEFAULT', invalidMsg, { parse_mode: 'Markdown' });
      return;
    }

    // Remove selected members from bench
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
      const noRemoved = REMOVE.noRemovedMembers;
      sendMessage(msg, 'DEFAULT', noRemoved);
      return;
    }

    const successMsg = REMOVE.success
      .replace('{count}', removedNames.length)
      .replace('{removedNames}', removedNames.join('\n'));
    sendMessage(msg, 'DEFAULT', successMsg, { parse_mode: 'Markdown' });
  });
};

module.exports = clearBenchCommand;
