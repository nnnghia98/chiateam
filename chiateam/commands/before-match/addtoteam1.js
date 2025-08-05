const { ADD_TO_TEAM } = require('../../utils/messages');

const addToTeam1Command = (bot, members, teamA) => {
  bot.onText(/^\/addtoteam1$/, msg => {
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      bot.sendMessage(msg.chat.id, ADD_TO_TEAM.emptyList);
      return;
    }

    const numberedList = allNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = ADD_TO_TEAM.usage
      .replace('{numberedList}', numberedList)
      .replace(/{team}/g, '1');

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/addtoteam1 (.+)$/, (msg, match) => {
    const selection = match[1].trim();
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      bot.sendMessage(msg.chat.id, ADD_TO_TEAM.emptyList);
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
      bot.sendMessage(
        msg.chat.id,
        ADD_TO_TEAM.invalidSelection.replace(/{team}/g, '1'),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    selectedIndices.sort((a, b) => a - b);

    const selectedNames = selectedIndices.map(index => allNames[index]);

    selectedNames.forEach(name => {
      for (const [userId, memberName] of members) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          members.delete(userId);
          break;
        }
      }
    });

    selectedNames.forEach((name, idx) => {
      const fakeId = Date.now() + Math.random() + idx;
      teamA.set(fakeId, name);
    });

    const message = ADD_TO_TEAM.success
      .replace('{count}', selectedNames.length)
      .replace('{team}', 'Team A')
      .replace('{selectedNames}', selectedNames.join('\n'))
      .replace('{teamMembers}', Array.from(teamA.values()).join('\n'));

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = addToTeam1Command;
