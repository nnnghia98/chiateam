const { RESET_TEAM_INDIVIDUAL } = require('../../utils/messages');

const resetteam1Command = (bot, teamA, members) => {
  bot.onText(/^\/resetteam1$/, msg => {
    const teamANames = Array.from(teamA.values());

    if (teamANames.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        RESET_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', 'Team A')
      );
      return;
    }

    const numberedList = teamANames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = RESET_TEAM_INDIVIDUAL.usage
      .replace('{team}', 'Team A')
      .replace('{teamNum}', '1')
      .replace('{numberedList}', numberedList);
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/resetteam1 (.+)$/, (msg, match) => {
    const selection = match[1].trim();
    const teamANames = Array.from(teamA.values());

    if (teamANames.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        RESET_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', 'Team A')
      );
      return;
    }

    let selectedIndices = [];

    if (selection.toLowerCase() === 'all') {
      selectedIndices = teamANames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());

      for (const part of parts) {
        if (part.startsWith('"') && part.endsWith('"')) {
          const nameToFind = part.slice(1, -1).trim();
          const nameIndex = teamANames.findIndex(name =>
            name.toLowerCase().includes(nameToFind.toLowerCase())
          );
          if (nameIndex !== -1) {
            selectedIndices.push(nameIndex);
          }
        } else if (part.includes('-')) {
          const [start, end] = part.split('-').map(num => parseInt(num.trim()));
          if (
            !isNaN(start) &&
            !isNaN(end) &&
            start > 0 &&
            end <= teamANames.length &&
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
          if (!isNaN(num) && num > 0 && num <= teamANames.length) {
            const index = num - 1;
            if (!selectedIndices.includes(index)) {
              selectedIndices.push(index);
            }
          } else {
            const nameIndex = teamANames.findIndex(name =>
              name.toLowerCase().includes(part.toLowerCase())
            );
            if (nameIndex !== -1) {
              selectedIndices.push(nameIndex);
            }
          }
        }
      }
    }

    if (selectedIndices.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        RESET_TEAM_INDIVIDUAL.invalidSelection.replace(/{teamNum}/g, '1'),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => b - a);
    const resetNames = [];

    for (const index of selectedIndices) {
      const name = teamANames[index];

      for (const [userId, memberName] of teamA) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          teamA.delete(userId);
          resetNames.push(name);
          break;
        }
      }
    }

    if (resetNames.length === 0) {
      bot.sendMessage(msg.chat.id, RESET_TEAM_INDIVIDUAL.noResetMembers);
      return;
    }

    let addedCount = 0;
    resetNames.forEach(name => {
      const fakeId = Date.now() + Math.random() + addedCount;
      members.set(fakeId, name);
      addedCount++;
    });

    const message = RESET_TEAM_INDIVIDUAL.success
      .replace('{count}', resetNames.length)
      .replace('{team}', 'Team A')
      .replace('{resetNames}', resetNames.join('\n'));
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = resetteam1Command;
