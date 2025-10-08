const { CLEAR_BENCH, VALIDATION } = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const clearBenchCommand = ({ members }) => {
  bot.onText(/^\/clearbench$/, msg => {
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_BENCH.emptyBench,
      });
      return;
    }

    const numberedList = allNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = CLEAR_BENCH.instruction.replace(
      '{numberedList}',
      numberedList
    );
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: message,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(/^\/clearbench (.+)$/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: VALIDATION.onlyAdmin,
      });
      return;
    }

    if (members.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_BENCH.emptyBench,
      });
      return;
    }

    const selection = match[1].trim();
    const allNames = Array.from(members.values());

    // Handle clear all
    if (selection.toLowerCase() === 'all') {
      members.clear();
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_BENCH.clearAllSuccess,
      });
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
      const invalidMsg = CLEAR_BENCH.invalidSelection.replaceAll(
        '/remove',
        '/clearbench'
      );
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: invalidMsg,
        options: { parse_mode: 'Markdown' },
      });
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
      const noRemoved = CLEAR_BENCH.noRemovedMembers;
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: noRemoved,
      });
      return;
    }

    const successMsg = CLEAR_BENCH.success
      .replace('{count}', removedNames.length)
      .replace('{removedNames}', removedNames.join('\n'));
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: successMsg,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = clearBenchCommand;
