const { getDisplayName } = require('../../utils/team-member');
const { CLEAR_BENCH, VALIDATION } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { isAdmin } = require('../../utils/validate');
const { escapeMarkdown } = require('../../utils/format');
const { registerCallbackQueryHandler } = require('../common/callback-query');

const bot = require('../../telegram-client');

const CLEAR_BENCH_CALLBACK_PREFIX = 'clearbench:remove:';
const CLEAR_BENCH_PAGE_CALLBACK_PREFIX = 'clearbench:page:';
const CLEAR_BENCH_PAGE_SIZE = 10;

function normalizePage(page, totalEntries) {
  const maxPage = Math.max(
    0,
    Math.ceil(totalEntries / CLEAR_BENCH_PAGE_SIZE) - 1
  );
  return Math.min(Math.max(page, 0), maxPage);
}

function buildClearBenchKeyboard(allEntries, page = 0) {
  const currentPage = normalizePage(page, allEntries.length);
  const startIndex = currentPage * CLEAR_BENCH_PAGE_SIZE;
  const pageEntries = allEntries.slice(
    startIndex,
    startIndex + CLEAR_BENCH_PAGE_SIZE
  );
  const keyboard = pageEntries.map(([, entry], offset) => {
    const index = startIndex + offset;

    return [
      {
        text: `${index + 1}. ${getDisplayName(entry)}`,
        callback_data: `${CLEAR_BENCH_CALLBACK_PREFIX}${index}`,
      },
    ];
  });

  if (allEntries.length > CLEAR_BENCH_PAGE_SIZE) {
    const navRow = [];

    if (currentPage > 0) {
      navRow.push({
        text: '⬅️ Trước',
        callback_data: `${CLEAR_BENCH_PAGE_CALLBACK_PREFIX}${currentPage - 1}`,
      });
    }

    const totalPages = Math.ceil(allEntries.length / CLEAR_BENCH_PAGE_SIZE);
    navRow.push({
      text: `${currentPage + 1}/${totalPages}`,
      callback_data: `${CLEAR_BENCH_PAGE_CALLBACK_PREFIX}${currentPage}`,
    });

    if ((currentPage + 1) * CLEAR_BENCH_PAGE_SIZE < allEntries.length) {
      navRow.push({
        text: 'Tiếp ➡️',
        callback_data: `${CLEAR_BENCH_PAGE_CALLBACK_PREFIX}${currentPage + 1}`,
      });
    }

    keyboard.push(navRow);
  }

  return keyboard;
}

async function handleClearBenchCallback(query, members) {
  if (
    !query.data?.startsWith(CLEAR_BENCH_CALLBACK_PREFIX) &&
    !query.data?.startsWith(CLEAR_BENCH_PAGE_CALLBACK_PREFIX)
  ) {
    return false;
  }

  if (!isAdmin(query.from?.id)) {
    await bot.answerCallbackQuery(query.id, {
      text: VALIDATION.onlyAdmin,
      show_alert: false,
    });
    return true;
  }

  if (query.data.startsWith(CLEAR_BENCH_PAGE_CALLBACK_PREFIX)) {
    const page = Number(
      query.data.slice(CLEAR_BENCH_PAGE_CALLBACK_PREFIX.length)
    );
    const allEntries = Array.from(members.entries());

    if (allEntries.length === 0) {
      await bot.answerCallbackQuery(query.id, {
        text: CLEAR_BENCH.emptyBench,
        show_alert: false,
      });
      return true;
    }

    await bot.editMessageReplyMarkup(
      {
        inline_keyboard: buildClearBenchKeyboard(
          allEntries,
          Number.isInteger(page) ? page : 0
        ),
      },
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    );
    await bot.answerCallbackQuery(query.id, {
      text: '',
      show_alert: false,
    });
    return true;
  }

  const index = Number(query.data.slice(CLEAR_BENCH_CALLBACK_PREFIX.length));
  const allEntries = Array.from(members.entries());
  const selectedEntry = Number.isInteger(index) ? allEntries[index] : null;

  if (!selectedEntry) {
    await bot.answerCallbackQuery(query.id, {
      text: CLEAR_BENCH.staleButton,
      show_alert: false,
    });
    return true;
  }

  const [key, member] = selectedEntry;
  const name = getDisplayName(member);
  members.delete(key);

  await bot.answerCallbackQuery(query.id, {
    text: CLEAR_BENCH.singleSuccess.replace('{name}', name),
    show_alert: false,
  });

  await sendMessage({
    msg: query.message,
    type: 'DEFAULT',
    message: CLEAR_BENCH.singleSuccess.replace(
      '{name}',
      escapeMarkdown(name)
    ),
    options: { parse_mode: 'Markdown' },
  });

  return true;
}

const clearBenchCommand = ({ members }) => {
  registerCallbackQueryHandler(query =>
    handleClearBenchCallback(query, members)
  );

  bot.onText(/^\/clearbench$/, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    try {
      const allEntries = Array.from(members.entries());

      if (allEntries.length === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: CLEAR_BENCH.emptyBench,
        });
        return;
      }

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_BENCH.instruction,
        options: {
          reply_markup: {
            inline_keyboard: buildClearBenchKeyboard(allEntries),
          },
        },
      });
    } catch (error) {
      console.error('❌ [clearbench] Error listing bench:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_BENCH.listError,
      });
    }
  });

  bot.onText(/^\/clearbench (.+)$/, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    try {
      if (members.size === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: CLEAR_BENCH.emptyBench,
        });
        return;
      }

      const selection = match[1].trim();
      const allEntries = Array.from(members.entries());
      const allNames = allEntries.map(([, v]) => getDisplayName(v));

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
      const selectedEntries = selectedIndices.map(i => allEntries[i]);
      selectedEntries.forEach(([key]) => members.delete(key));
      const removedNames = selectedEntries.map(([, v]) => getDisplayName(v));

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
        .replace(
          '{removedNames}',
          removedNames.map(name => escapeMarkdown(name)).join('\n')
        );
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: successMsg,
        options: { parse_mode: 'Markdown' },
      });
    } catch (error) {
      console.error('❌ [clearbench] Error:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CLEAR_BENCH.removeError,
      });
    }
  });
};

module.exports = clearBenchCommand;
