const { getDisplayName } = require('../../utils/team-member');
const { ADD_TO_TEAM, VALIDATION } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { escapeMarkdown } = require('../../utils/format');
const { isAdmin } = require('../../utils/validate');
const { buildPaginatedKeyboard } = require('../../utils/inline-keyboard');
const { registerCallbackQueryHandler } = require('../common/callback-query');

const bot = require('../../telegram-client');

const ADD_TO_TEAM_ADD_PREFIX = 'addteam:add:';
const ADD_TO_TEAM_PAGE_PREFIX = 'addteam:page:';

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

  const getTeamName = teamType =>
    teamType === 'HOME' ? 'Home' : teamType === 'AWAY' ? 'Away' : 'Extra';

  const buildKeyboard = ({ mode, teamType, page = 0 }) => {
    const allEntries = Array.from(members.entries());

    return buildPaginatedKeyboard({
      entries: allEntries,
      page,
      pageCallbackPrefix: `${ADD_TO_TEAM_PAGE_PREFIX}${mode}:${teamType}:`,
      itemToButton: (([, entry], index) => ({
        text: `${index + 1}. ${getDisplayName(entry)}`,
        callback_data: `${ADD_TO_TEAM_ADD_PREFIX}${mode}:${teamType}:${index}`,
      })),
    });
  };

  const addEntryToTeam = ({ entry, team, teamName, msg }) => {
    const existingInTeam = new Set(Array.from(team.values()));

    if (existingInTeam.has(entry)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_TO_TEAM.allDuplicates
          .replace('{count}', 1)
          .replace('{team}', teamName),
      });
      return false;
    }

    team.set(Date.now() + Math.random(), entry);

    const selectedName = getDisplayName(entry);
    const teamMemberDisplays = Array.from(team.values()).map(getDisplayName);
    const message = ADD_TO_TEAM.success
      .replace('{count}', 1)
      .replaceAll('{team}', teamName)
      .replace('{selectedNames}', escapeMarkdown(selectedName))
      .replace(
        '{teamMembers}',
        teamMemberDisplays.map(name => escapeMarkdown(name)).join('\n')
      );

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: { parse_mode: 'Markdown' },
    });
    return true;
  };

  registerCallbackQueryHandler(async query => {
    const data = query.data || '';
    const isAdd = data.startsWith(ADD_TO_TEAM_ADD_PREFIX);
    const isPage = data.startsWith(ADD_TO_TEAM_PAGE_PREFIX);

    if (!isAdd && !isPage) {
      return false;
    }

    if (!isAdmin(query.from?.id)) {
      await bot.answerCallbackQuery(query.id, {
        text: VALIDATION.onlyAdmin,
        show_alert: false,
      });
      return true;
    }

    if (isPage) {
      const [, modeRaw, teamType, pageRaw] = data.match(
        /^addteam:page:(\d):(HOME|AWAY|EXTRA):(\d+)$/
      ) || [null, null, null, null];

      await bot.editMessageReplyMarkup(
        {
          inline_keyboard: buildKeyboard({
            mode: parseInt(modeRaw, 10) || 2,
            teamType,
            page: parseInt(pageRaw, 10) || 0,
          }),
        },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    const [, modeRaw, teamType, indexRaw] = data.match(
      /^addteam:add:(\d):(HOME|AWAY|EXTRA):(\d+)$/
    ) || [null, null, null, null];
    const mode = parseInt(modeRaw, 10) || 2;
    const index = parseInt(indexRaw, 10);
    const team = getTeam(mode, teamType);
    const allEntries = Array.from(members.entries());
    const selectedEntry = Number.isInteger(index) ? allEntries[index] : null;

    if (!team || !selectedEntry) {
      await bot.answerCallbackQuery(query.id, {
        text: ADD_TO_TEAM.invalidSelection,
        show_alert: false,
      });
      return true;
    }

    addEntryToTeam({
      entry: selectedEntry[1],
      team,
      teamName: getTeamName(teamType),
      msg: query.message,
    });
    await bot.answerCallbackQuery(query.id, {
      text: `Đã thêm ${getDisplayName(selectedEntry[1])}`,
      show_alert: false,
    });
    return true;
  });

  bot.onText(/^\/addtoteam$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: ADD_TO_TEAM.usage,
      options: { parse_mode: 'Markdown' },
    });
  });

  // /addtoteam [2|3] HOME|AWAY|EXTRA - show instruction
  bot.onText(/^\/addtoteam (2|3)?\s*(HOME|AWAY|EXTRA)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const mode = match[1] ? parseInt(match[1]) : 2; // Default to 2-team mode
    const teamType = match[2];
    const teamName = getTeamName(teamType);
    const allEntries = Array.from(members.entries());

    if (allEntries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ADD_TO_TEAM.emptyBench,
      });
      return;
    }

    const message = ADD_TO_TEAM.instruction.replace(/{team}/g, teamName);

    sendMessage({
      msg,
      type: 'MAIN',
      message,
      options: {
        reply_markup: {
          inline_keyboard: buildKeyboard({ mode, teamType }),
        },
      },
    });
  });

  // /addtoteam [2|3] HOME|AWAY|EXTRA selection - add members to team
  bot.onText(/^\/addtoteam (2|3)?\s*(HOME|AWAY|EXTRA) (.+)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const mode = match[1] ? parseInt(match[1]) : 2; // Default to 2-team mode
    const teamType = match[2];
    const selection = match[3].trim();
    const team = getTeam(mode, teamType);
    const teamName = getTeamName(teamType);
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
      message += ADD_TO_TEAM.duplicateSkipped
        .replace('{count}', duplicates.length)
        .replace('{team}', teamName)
        .replace(
          '{names}',
          duplicates.map(name => escapeMarkdown(name)).join(', ')
        );
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
      message = ADD_TO_TEAM.allDuplicates
        .replace('{count}', duplicates.length)
        .replace('{team}', teamName);
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
