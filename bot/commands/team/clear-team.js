const {
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
  VALIDATION,
} = require('../../utils/messages');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');

const bot = require('../../bot');

const clearTeamCommand = ({ teamA, teamB, team3A, team3B, team3C }) => {
  // Clear ALL team maps. Players stay in bench (bench is the persistent roster).
  bot.onText(/^\/clearteam$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    if (teamA.size === 0 && teamB.size === 0 && team3A.size === 0 && team3B.size === 0 && team3C.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM.emptyTeam,
      });
      return;
    }

    teamA.clear();
    teamB.clear();
    team3A.clear();
    team3B.clear();
    team3C.clear();

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: CLEAR_TEAM.success,
    });
  });

  // Show team roster for selective clear (HOME / AWAY / EXTRA)
  bot.onText(/^\/clearteam (HOME|AWAY|EXTRA)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const teamType = match[1];
    const team = teamType === 'HOME' ? teamA : teamType === 'AWAY' ? teamB : team3C;
    const teamName = teamType === 'HOME' ? 'Home' : teamType === 'AWAY' ? 'Away' : 'Extra';
    const teamEntries = Array.from(team.entries());
    const teamNames = teamEntries.map(([, v]) => getDisplayName(v));

    if (teamNames.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', teamName),
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    const numberedList = teamNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = CLEAR_TEAM_INDIVIDUAL.instruction
      .replace('{team}', teamName)
      .replace(/{teamType}/g, ` ${teamType}`)
      .replace('{numberedList}', numberedList);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });

  // Clear specific members from a team (HOME / AWAY / EXTRA)
  bot.onText(/^\/clearteam (HOME|AWAY|EXTRA) (.+)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const teamType = match[1];
    const selection = match[2].trim();
    const team = teamType === 'HOME' ? teamA : teamType === 'AWAY' ? teamB : team3C;
    const teamName = teamType === 'HOME' ? 'Home' : teamType === 'AWAY' ? 'Away' : 'Extra';
    const teamEntries = Array.from(team.entries());
    const teamNames = teamEntries.map(([, v]) => getDisplayName(v));

    if (teamNames.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', teamName),
      });
      return;
    }

    let selectedIndices = [];

    if (selection.toLowerCase() === 'all') {
      selectedIndices = teamNames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());

      for (const part of parts) {
        if (part.startsWith('"') && part.endsWith('"')) {
          const nameToFind = part.slice(1, -1).trim();
          const nameIndex = teamNames.findIndex(name =>
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
            end <= teamNames.length &&
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
          if (!isNaN(num) && num > 0 && num <= teamNames.length) {
            const index = num - 1;
            if (!selectedIndices.includes(index)) {
              selectedIndices.push(index);
            }
          } else {
            const nameIndex = teamNames.findIndex(name =>
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
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM_INDIVIDUAL.invalidSelection.replace(
          /{teamType}/g,
          ` ${teamType}`
        ),
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => b - a);
    const selectedEntries = selectedIndices.map(i => teamEntries[i]);
    const resetNames = selectedEntries.map(([, v]) => getDisplayName(v));

    if (resetNames.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM_INDIVIDUAL.noResetMembers,
      });
      return;
    }

    // Remove from team only (player remains in bench)
    selectedEntries.forEach(([key]) => team.delete(key));

    const message = CLEAR_TEAM_INDIVIDUAL.success
      .replace('{count}', resetNames.length)
      .replace('{team}', teamName)
      .replace('{resetNames}', resetNames.join('\n'));

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = clearTeamCommand;
