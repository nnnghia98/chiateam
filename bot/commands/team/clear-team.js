const {
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
  VALIDATION,
} = require('../../utils/messages');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { isAdmin } = require('../../utils/validate');
const { escapeMarkdown } = require('../../utils/format');
const { buildPaginatedKeyboard } = require('../../utils/inline-keyboard');
const { registerCallbackQueryHandler } = require('../common/callback-query');

const bot = require('../../telegram-client');

const CLEAR_TEAM_REMOVE_PREFIX = 'clearteam:remove:';
const CLEAR_TEAM_PAGE_PREFIX = 'clearteam:page:';

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
    }

    return null;
  };

  const getTeamName = teamType =>
    teamType === 'HOME' ? 'Home' : teamType === 'AWAY' ? 'Away' : 'Extra';

  const buildKeyboard = ({ mode, teamType, page = 0 }) => {
    const team = getTeam(mode, teamType);
    const teamEntries = team ? Array.from(team.entries()) : [];

    return buildPaginatedKeyboard({
      entries: teamEntries,
      page,
      pageCallbackPrefix: `${CLEAR_TEAM_PAGE_PREFIX}${mode}:${teamType}:`,
      itemToButton: (([, entry], index) => ({
        text: `${index + 1}. ${getDisplayName(entry)}`,
        callback_data: `${CLEAR_TEAM_REMOVE_PREFIX}${mode}:${teamType}:${index}`,
      })),
    });
  };

  registerCallbackQueryHandler(async query => {
    const data = query.data || '';
    const isRemove = data.startsWith(CLEAR_TEAM_REMOVE_PREFIX);
    const isPage = data.startsWith(CLEAR_TEAM_PAGE_PREFIX);

    if (!isRemove && !isPage) {
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
        /^clearteam:page:(\d):(HOME|AWAY|EXTRA):(\d+)$/
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
      /^clearteam:remove:(\d):(HOME|AWAY|EXTRA):(\d+)$/
    ) || [null, null, null, null];
    const mode = parseInt(modeRaw, 10) || 2;
    const index = parseInt(indexRaw, 10);
    const team = getTeam(mode, teamType);
    const teamEntries = team ? Array.from(team.entries()) : [];
    const selectedEntry = Number.isInteger(index) ? teamEntries[index] : null;

    if (!team || !selectedEntry) {
      await bot.answerCallbackQuery(query.id, {
        text: CLEAR_TEAM_INDIVIDUAL.invalidSelection,
        show_alert: false,
      });
      return true;
    }

    const [key, member] = selectedEntry;
    const name = getDisplayName(member);
    team.delete(key);

    await bot.answerCallbackQuery(query.id, {
      text: `Đã xóa ${name}`,
      show_alert: false,
    });
    await sendMessage({
      msg: query.message,
      type: 'DEFAULT',
      message: CLEAR_TEAM_INDIVIDUAL.success
        .replace('{count}', 1)
        .replace('{team}', getTeamName(teamType))
        .replace('{resetNames}', escapeMarkdown(name)),
      options: { parse_mode: 'Markdown' },
    });
    return true;
  });

  // Show instruction. Explicit stack clearing uses /clearteam 2 or /clearteam 3.
  bot.onText(/^\/clearteam$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: CLEAR_TEAM.instruction,
      options: { parse_mode: 'Markdown' },
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
          message: CLEAR_TEAM.stack2Empty,
        });
        return;
      }

      teamA.clear();
      teamB.clear();

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM.stack2Success,
      });
    } else if (mode === 3) {
      if (team3A.size === 0 && team3B.size === 0 && team3C.size === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: CLEAR_TEAM.stack3Empty,
        });
        return;
      }

      team3A.clear();
      team3B.clear();
      team3C.clear();

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM.stack3Success,
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
    if (!team) {
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

    const teamName = getTeamName(teamType);
    const teamEntries = Array.from(team.entries());

    if (teamEntries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_TEAM_INDIVIDUAL.emptyTeam.replace('{team}', teamName),
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    const message = CLEAR_TEAM_INDIVIDUAL.instruction
      .replace('{team}', teamName)
      .replace(/{teamType}/g, ` ${teamType}`);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: {
        reply_markup: {
          inline_keyboard: buildKeyboard({ mode, teamType }),
        },
      },
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
    if (!team) {
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

    const teamName = getTeamName(teamType);
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
