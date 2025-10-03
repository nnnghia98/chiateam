const {
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
  VALIDATION,
} = require('../../utils/messages');
const { isAdmin } = require('../../utils/validate');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const clearTeamCommand = ({ teamA, teamB, members }) => {
  bot.onText(/^\/clearteam$/, msg => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    if (teamA.size === 0 && teamB.size === 0) {
      sendMessage(msg, 'DEFAULT', CLEAR_TEAM.emptyTeam);
      return;
    }

    const allTeamMembers = [...teamA.values(), ...teamB.values()];
    let restoredCount = 0;

    allTeamMembers.forEach((name, index) => {
      const fakeId = Date.now() + Math.random() + index;
      members.set(fakeId, name);
      restoredCount++;
    });

    teamA.clear();
    teamB.clear();

    sendMessage(msg, 'DEFAULT', CLEAR_TEAM_INDIVIDUAL.success);
  });

  bot.onText(/^\/clearteam (HOME|AWAY)$/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      sendMessage(msg, 'DEFAULT', VALIDATION.onlyAdmin);
      return;
    }

    const teamType = match[1];
    const team = teamType === 'HOME' ? teamA : teamB;
    const teamName = teamType === 'HOME' ? 'Home' : 'Away';
    const teamANames = Array.from(team.values());

    if (teamANames.length === 0) {
      sendMessage(
        msg,
        'DEFAULT',
        CLEAR_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', teamName),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const numberedList = teamANames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = CLEAR_TEAM_INDIVIDUAL.instruction
      .replace('{team}', teamName)
      .replace('{teamNum}', '1')
      .replace('{numberedList}', numberedList);
    sendMessage(msg, 'DEFAULT', message, {
      parse_mode: 'Markdown',
    });
  });

  bot.onText(/^\/clearteam (HOME|AWAY) (.+)$/, (msg, match) => {
    const teamType = match[1];
    const selection = match[2].trim();
    const team = teamType === 'HOME' ? teamA : teamB;
    const teamName = teamType === 'HOME' ? 'Home' : 'Away';
    const teamANames = Array.from(team.values());

    if (teamANames.length === 0) {
      sendMessage(
        msg,
        'DEFAULT',
        CLEAR_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', teamName)
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
      sendMessage(
        msg,
        'DEFAULT',
        CLEAR_TEAM_INDIVIDUAL.invalidSelection.replace(/{teamNum}/g, '1'),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => b - a);
    const resetNames = [];

    for (const index of selectedIndices) {
      const name = teamANames[index];

      for (const [userId, memberName] of team) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          team.delete(userId);
          resetNames.push(name);
          break;
        }
      }
    }

    if (resetNames.length === 0) {
      sendMessage(msg, 'DEFAULT', CLEAR_TEAM_INDIVIDUAL.noResetMembers);
      return;
    }

    let addedCount = 0;
    resetNames.forEach(name => {
      const fakeId = Date.now() + Math.random() + addedCount;
      members.set(fakeId, name);
      addedCount++;
    });

    const message = CLEAR_TEAM_INDIVIDUAL.success
      .replace('{count}', resetNames.length)
      .replace('{team}', teamName)
      .replace('{resetNames}', resetNames.join('\n'));
    sendMessage(msg, 'DEFAULT', message, {
      parse_mode: 'Markdown',
    });
  });
};

module.exports = clearTeamCommand;
