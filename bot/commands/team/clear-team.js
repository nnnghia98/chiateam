const {
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
} = require('../../utils/messages');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { escapeMarkdown } = require('../../utils/format');

const bot = require('../../bot');

const clearTeamCommand = ({ teamA, teamB, team3A, team3B, team3C }) => {
  // Helper: Get the correct team based on mode (2 or 3) and team type
  const getTeam = (mode, teamType) => {
    if (mode === 3) {
      if (teamType === 'HOME') return team3A;
      if (teamType === 'AWAY') return team3B;
      if (teamType === 'EXTRA') return team3C;
    } else {
      // mode === 2 (default)
      if (teamType === 'HOME') return teamA;
      if (teamType === 'AWAY') return teamB;
      if (teamType === 'EXTRA') return team3C;
    }
    
    return null;
  };

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

  // Clear specific team stack (2-team or 3-team)
  bot.onText(/^\/clearteam (2|3)$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    const mode = parseInt(msg.text.match(/\d+/)[0]);

    if (mode === 2) {
      if (teamA.size === 0 && teamB.size === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: '⚠️ 2-team stack đã trống rồi.',
        });
        return;
      }

      teamA.clear();
      teamB.clear();

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '✅ Đã xóa toàn bộ 2-team stack (HOME, AWAY).',
      });
    } else if (mode === 3) {
      if (team3A.size === 0 && team3B.size === 0 && team3C.size === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: '⚠️ 3-team stack đã trống rồi.',
        });
        return;
      }

      team3A.clear();
      team3B.clear();
      team3C.clear();

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '✅ Đã xóa toàn bộ 3-team stack (HOME, AWAY, EXTRA).',
      });
    }
  });

  // Show team roster for selective clear (HOME / AWAY / EXTRA)
  bot.onText(/^\/clearteam (2|3)?\s*(HOME|AWAY|EXTRA)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const mode = match[1] ? parseInt(match[1]) : 2; // Default to 2-team mode
    const teamType = match[2];
    const team = getTeam(mode, teamType);
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
      .map((name, index) => `${index + 1}. ${escapeMarkdown(name)}`)
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
  bot.onText(/^\/clearteam (2|3)?\s*(HOME|AWAY|EXTRA) (.+)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const mode = match[1] ? parseInt(match[1]) : 2; // Default to 2-team mode
    const teamType = match[2];
    const selection = match[3].trim();
    const team = getTeam(mode, teamType);
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
      .replace(
        '{resetNames}',
        resetNames.map(name => escapeMarkdown(name)).join('\n')
      );

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = clearTeamCommand;
