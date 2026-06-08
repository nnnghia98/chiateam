const {
  isAdmin,
  isDuplicateName,
  isValidName,
} = require('../../utils/validate');
const { EDIT_BENCH, VALIDATION } = require('../../utils/messages');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { escapeMarkdown } = require('../../utils/format');
const { PATTERNS } = require('../../utils/constants');
const { buildPaginatedKeyboard } = require('../../utils/inline-keyboard');
const { registerCallbackQueryHandler } = require('../common/callback-query');

const bot = require('../../telegram-client');

const EDIT_BENCH_SELECT_PREFIX = 'editbench:select:';
const EDIT_BENCH_PAGE_PREFIX = 'editbench:page:';
const pendingEditBench = new Map();

function getIdentity(entry, key) {
  if (entry && typeof entry === 'object' && entry.userId != null) {
    return `tele:${entry.userId}`;
  }

  if (entry && typeof entry === 'object' && entry.memberId) {
    return `member:${entry.memberId}`;
  }

  return `bench:${String(key)}`;
}

function ensureMemberShape(entry, key) {
  if (typeof entry === 'string') {
    return {
      name: entry,
      memberId: `bench:${String(key)}`,
    };
  }

  if (!entry || typeof entry !== 'object') {
    return {
      name: '',
      memberId: `bench:${String(key)}`,
    };
  }

  if (entry.userId == null && !entry.memberId) {
    entry.memberId = `bench:${String(key)}`;
  }

  return entry;
}

function getPendingKey(msg) {
  return `${msg.chat.id}:${msg.from.id}`;
}

const editBenchCommand = ({ members }) => {
  const buildKeyboard = (page = 0) => {
    const allEntries = Array.from(members.entries());

    return buildPaginatedKeyboard({
      entries: allEntries,
      page,
      pageCallbackPrefix: EDIT_BENCH_PAGE_PREFIX,
      itemToButton: (([, entry], index) => ({
        text: `${index + 1}. ${getDisplayName(entry)}`,
        callback_data: `${EDIT_BENCH_SELECT_PREFIX}${index}`,
      })),
    });
  };

  const renameMember = ({ selectedNumber, newName, msg }) => {
    const allEntries = Array.from(members.entries());

    if (allEntries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.emptyBench,
      });
      return false;
    }

    if (
      !Number.isInteger(selectedNumber) ||
      selectedNumber < 1 ||
      selectedNumber > allEntries.length
    ) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.invalidSelection,
      });
      return false;
    }

    if (!isValidName(newName)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.invalidName,
      });
      return false;
    }

    const [targetKey, targetEntryRaw] = allEntries[selectedNumber - 1];
    const targetEntry = ensureMemberShape(targetEntryRaw, targetKey);
    const oldName = getDisplayName(targetEntryRaw);
    const targetIdentity = getIdentity(targetEntry, targetKey);

    const otherNames = allEntries
      .filter(([key, value]) => {
        const normalized = ensureMemberShape(value, key);
        return getIdentity(normalized, key) !== targetIdentity;
      })
      .map(([, value]) => getDisplayName(value));

    if (isDuplicateName(newName, otherNames)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.duplicateName.replace('{name}', newName),
      });
      return false;
    }

    targetEntry.name = newName;
    members.set(targetKey, targetEntry);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: EDIT_BENCH.success
        .replace('{oldName}', oldName)
        .replace('{newName}', newName),
    });
    return true;
  };

  registerCallbackQueryHandler(async query => {
    const data = query.data || '';
    const isSelect = data.startsWith(EDIT_BENCH_SELECT_PREFIX);
    const isPage = data.startsWith(EDIT_BENCH_PAGE_PREFIX);

    if (!isSelect && !isPage) {
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
      const page = parseInt(data.slice(EDIT_BENCH_PAGE_PREFIX.length), 10) || 0;
      await bot.editMessageReplyMarkup(
        { inline_keyboard: buildKeyboard(page) },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
      return true;
    }

    const index = parseInt(data.slice(EDIT_BENCH_SELECT_PREFIX.length), 10);
    const allEntries = Array.from(members.entries());
    const selectedEntry = Number.isInteger(index) ? allEntries[index] : null;

    if (!selectedEntry) {
      await bot.answerCallbackQuery(query.id, {
        text: EDIT_BENCH.invalidSelection,
        show_alert: false,
      });
      return true;
    }

    pendingEditBench.set(getPendingKey({
      chat: query.message.chat,
      from: query.from,
    }), {
      selectedNumber: index + 1,
      name: getDisplayName(selectedEntry[1]),
    });

    await bot.answerCallbackQuery(query.id, { text: '', show_alert: false });
    sendMessage({
      msg: query.message,
      type: 'DEFAULT',
      message: EDIT_BENCH.namePrompt.replace(
        '{name}',
        escapeMarkdown(getDisplayName(selectedEntry[1]))
      ),
      options: { parse_mode: 'Markdown' },
    });
    return true;
  });

  bot.on('message', msg => {
    if (!msg.text || msg.text.startsWith('/')) {
      return;
    }

    const pendingKey = getPendingKey(msg);
    const pending = pendingEditBench.get(pendingKey);

    if (!pending) {
      return;
    }

    if (!isAdmin(msg.from?.id)) {
      pendingEditBench.delete(pendingKey);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: VALIDATION.onlyAdmin,
      });
      return;
    }

    const renamed = renameMember({
      selectedNumber: pending.selectedNumber,
      newName: msg.text.trim(),
      msg,
    });

    if (renamed) {
      pendingEditBench.delete(pendingKey);
    }
  });

  bot.onText(PATTERNS.edit_bench, msg => {
    if (!requireAdmin(msg)) {
      return;
    }

    const allEntries = Array.from(members.entries());

    if (allEntries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.emptyBench,
      });
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: EDIT_BENCH.instruction,
      options: {
        reply_markup: {
          inline_keyboard: buildKeyboard(),
        },
      },
    });
  });

  bot.onText(PATTERNS.edit_bench_update, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    renameMember({
      selectedNumber: parseInt(match[1], 10),
      newName: match[2].trim(),
      msg,
    });
  });
};

module.exports = editBenchCommand;
