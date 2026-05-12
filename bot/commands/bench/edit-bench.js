const { isValidName, isDuplicateName } = require('../../utils/validate');
const { EDIT_BENCH } = require('../../utils/messages');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { escapeMarkdown } = require('../../utils/format');
const { PATTERNS } = require('../../utils/constants');

const bot = require('../../telegram-client');

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

const editBenchCommand = ({ members }) => {
  bot.onText(PATTERNS.edit_bench, msg => {
    const allEntries = Array.from(members.entries());

    if (allEntries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.emptyBench,
      });
      return;
    }

    const numberedList = allEntries
      .map(([, value], index) => `${index + 1}. ${escapeMarkdown(getDisplayName(value))}`)
      .join('\n');

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: EDIT_BENCH.instruction.replace('{numberedList}', numberedList),
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(PATTERNS.edit_bench_update, (msg, match) => {
    if (!requireAdmin(msg)) {
      return;
    }

    const selectedNumber = parseInt(match[1], 10);
    const newName = match[2].trim();
    const allEntries = Array.from(members.entries());

    if (allEntries.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.emptyBench,
      });
      return;
    }

    if (!Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > allEntries.length) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.invalidSelection,
      });
      return;
    }

    if (!isValidName(newName)) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: EDIT_BENCH.invalidName,
      });
      return;
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
      return;
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
  });
};

module.exports = editBenchCommand;
