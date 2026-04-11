const { getDisplayName } = require('../../utils/team-member');
const { ADD_TO_TEAM } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { escapeMarkdown } = require('../../utils/format');

const bot = require('../../telegram-client');

const addToTeamCommand = ({
  members,
  teamA,
  teamB,
  team3A,
  team3B,
  team3C,
}) => {
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
      if (teamType === 'EXTRA') return team3C; // EXTRA always uses team3C
    }

    return null;
  };

  // /addtoteam [2|3] HOME|AWAY|EXTRA - show instruction
  bot.onText(/^\/addtoteam (2|3)?\s*(HOME|AWAY|EXTRA)$/, (msg, match) => {
    const mode = match[1] ? parseInt(match[1]) : 2; // Default to 2-team mode
    const teamType = match[2];
    const teamName =
      teamType === 'HOME' ? 'Home' : teamType === 'AWAY' ? 'Away' : 'Extra';
    const allEntries = Array.from(members.entries());
    const allNames = allEntries.map(([, v]) => getDisplayName(v));

    if (allNames.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_TO_TEAM.emptyBench,
      });
      return;
    }

    const numberedList = allNames
      .map((name, index) => `${index + 1}. ${escapeMarkdown(name)}`)
      .join('\n');

    const message = ADD_TO_TEAM.instruction
      .replace('{numberedList}', numberedList)
      .replace(/{team}/g, teamName);

    sendMessage({
      msg,
      type: 'MAIN',
      message,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  // /addtoteam [2|3] HOME|AWAY|EXTRA selection - add members to team
  bot.onText(/^\/addtoteam (2|3)?\s*(HOME|AWAY|EXTRA) (.+)$/, (msg, match) => {
    const mode = match[1] ? parseInt(match[1]) : 2; // Default to 2-team mode
    const teamType = match[2];
    const selection = match[3].trim();
    const team = getTeam(mode, teamType);
    const teamName =
      teamType === 'HOME' ? 'Home' : teamType === 'AWAY' ? 'Away' : 'Extra';
    const allEntries = Array.from(members.entries());
    const allNames = allEntries.map(([, v]) => getDisplayName(v));

    if (allNames.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_TO_TEAM.emptyBench,
      });
      return;
    }

    let selectedIndices = [];

    if (selection.toLowerCase() === 'all') {
      selectedIndices = allNames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());

      for (const part of parts) {
        if (part.startsWith('"') && part.endsWith('"')) {
          const nameToFind = part.slice(1, -1).trim();
          const nameIndex = allNames.findIndex(name =>
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
          } else {
            const nameIndex = allNames.findIndex(name =>
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
        message: ADD_TO_TEAM.invalidSelection.replace(/{team}/g, teamName),
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => a - b);
    const selectedEntries = selectedIndices.map(i => allEntries[i]);

    // Check for duplicates - members already in this team
    const existingInTeam = new Set(Array.from(team.values()));
    const duplicates = [];
    const toAdd = [];

    selectedEntries.forEach(([, entry]) => {
      if (existingInTeam.has(entry)) {
        duplicates.push(getDisplayName(entry));
      } else {
        toAdd.push(entry);
      }
    });

    // Add only non-duplicate members to team (player stays in bench — bench is the persistent roster)
    toAdd.forEach((entry, idx) => {
      const fakeId = Date.now() + Math.random() + idx;
      team.set(fakeId, entry);
    });

    const selectedNames = toAdd.map(v => getDisplayName(v));
    const teamMemberDisplays = Array.from(team.values()).map(getDisplayName);

    let message = '';
    if (duplicates.length > 0) {
      message += `⚠️ Đã bỏ qua ${duplicates.length} member đã có trong ${teamName}:\n${duplicates.map(name => escapeMarkdown(name)).join(', ')}\n\n`;
    }

    if (toAdd.length > 0) {
      message += ADD_TO_TEAM.success
        .replace('{count}', selectedNames.length)
        .replaceAll('{team}', teamName)
        .replace(
          '{selectedNames}',
          selectedNames.map(name => escapeMarkdown(name)).join('\n')
        )
        .replace(
          '{teamMembers}',
          teamMemberDisplays.map(name => escapeMarkdown(name)).join('\n')
        );
    } else if (duplicates.length > 0) {
      // All were duplicates, just show the duplicate warning
      message = `⚠️ Tất cả ${duplicates.length} member đã có trong ${teamName} rồi.`;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = addToTeamCommand;
