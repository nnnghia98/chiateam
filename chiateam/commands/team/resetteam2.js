const { RESET_TEAM_INDIVIDUAL } = require('../../utils/messages');
const { getChatId } = require('../../utils/chat');

const resetteam2Command = (bot, teamB, members) => {
  bot.onText(/^\/resetteam2$/, msg => {
    const teamBNames = Array.from(teamB.values());

    if (teamBNames.length === 0) {
      bot.sendMessage(
        getChatId(msg, 'DEFAULT'),
        RESET_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', 'Team B')
      );
      return;
    }

    const numberedList = teamBNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = RESET_TEAM_INDIVIDUAL.instruction
      .replace('{team}', 'Team B')
      .replace('{teamNum}', '2')
      .replace('{numberedList}', numberedList);
    bot.sendMessage(getChatId(msg, 'DEFAULT'), message, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(/^\/resetteam2 (.+)$/, (msg, match) => {
    const selection = match[1].trim();
    const teamBNames = Array.from(teamB.values());

    if (teamBNames.length === 0) {
      bot.sendMessage(
        getChatId(msg, 'DEFAULT'),
        RESET_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', 'Team B')
      );
      return;
    }

    let selectedIndices = [];

    if (selection.toLowerCase() === 'all') {
      selectedIndices = teamBNames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());

      for (const part of parts) {
        if (part.startsWith('"') && part.endsWith('"')) {
          const nameToFind = part.slice(1, -1).trim();
          const nameIndex = teamBNames.findIndex(name =>
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
            end <= teamBNames.length &&
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
          if (!isNaN(num) && num > 0 && num <= teamBNames.length) {
            const index = num - 1;
            if (!selectedIndices.includes(index)) {
              selectedIndices.push(index);
            }
          } else {
            const nameIndex = teamBNames.findIndex(name =>
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
        getChatId(msg, 'DEFAULT'),
        RESET_TEAM_INDIVIDUAL.invalidSelection.replace(/{teamNum}/g, '2'),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => b - a);
    const resetNames = [];

    for (const index of selectedIndices) {
      const name = teamBNames[index];

      for (const [userId, memberName] of teamB) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          teamB.delete(userId);
          resetNames.push(name);
          break;
        }
      }
    }

    if (resetNames.length === 0) {
      bot.sendMessage(
        getChatId(msg, 'DEFAULT'),
        RESET_TEAM_INDIVIDUAL.noResetMembers
      );
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
      .replace('{team}', 'Team B')
      .replace('{resetNames}', resetNames.join('\n'));
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = resetteam2Command;
