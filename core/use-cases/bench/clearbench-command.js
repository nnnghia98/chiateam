const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { normalizeBenchEntries } = require('./bench-member');

const CLEARBENCH_PAGE_SIZE = 10;

const CLEARBENCH_MESSAGES = Object.freeze({
  empty: '⚠️ Bench trống.',
  instruction: '📋 Chọn member cần xóa khỏi bench:',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n' +
    '/clearbench 1,3,5 hoặc /clearbench 1-3 hoặc /clearbench all',
  success: '✅ Đã xóa {count} member(s):\n{names}',
  singleSuccess: '✅ Đã xóa {name} khỏi bench.',
  clearAllSuccess: '✅ Đã xóa toàn bộ member khỏi bench.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải bench hiện tại từ API.',
  saveError: '❌ Không thể lưu thay đổi bench. Vui lòng thử lại.',
});

function parsePositiveInteger(value) {
  const text = String(value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function parseClearbenchSelection(value, totalEntries) {
  const selection = String(value ?? '').trim();

  if (!selection) {
    return null;
  }

  const selectedIndices = new Set();
  const parts = selection.split(',').map(part => part.trim());

  if (parts.some(part => !part)) {
    return null;
  }

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);

    if (range) {
      const start = parsePositiveInteger(range[1]);
      const end = parsePositiveInteger(range[2]);

      if (start == null || end == null || start > end || end > totalEntries) {
        return null;
      }

      for (let number = start; number <= end; number += 1) {
        selectedIndices.add(number - 1);
      }
      continue;
    }

    const number = parsePositiveInteger(part);

    if (number == null || number > totalEntries) {
      return null;
    }

    selectedIndices.add(number - 1);
  }

  return [...selectedIndices].sort((left, right) => left - right);
}

function normalizePageIndex(pageIndex, totalEntries) {
  const maxPage = Math.max(
    0,
    Math.ceil(totalEntries / CLEARBENCH_PAGE_SIZE) - 1
  );

  return Math.min(Math.max(pageIndex, 0), maxPage);
}

function createSelectionActions(entries, pageIndex) {
  const currentPage = normalizePageIndex(pageIndex, entries.length);
  const start = currentPage * CLEARBENCH_PAGE_SIZE;
  const actions = entries
    .slice(start, start + CLEARBENCH_PAGE_SIZE)
    .map(entry => {
      const number = entry.index + 1;

      return {
        id: `clearbench_remove_${number}`,
        label: `${number}. ${entry.name}`,
        command: `/clearbench ${number}`,
      };
    });
  const totalPages = Math.ceil(entries.length / CLEARBENCH_PAGE_SIZE);

  if (currentPage > 0) {
    actions.push({
      id: `clearbench_page_${currentPage}`,
      label: '⬅️ Trước',
      command: `/clearbench page ${currentPage}`,
    });
  }

  if (currentPage + 1 < totalPages) {
    actions.push({
      id: `clearbench_page_${currentPage + 2}`,
      label: 'Tiếp ➡️',
      command: `/clearbench page ${currentPage + 2}`,
    });
  }

  actions.push({
    id: 'clearbench_all',
    label: '🗑 Xóa tất cả',
    command: '/clearbench all',
  });

  return actions;
}

function createClearbenchCommand() {
  return createCommandDefinition({
    name: 'clearbench',
    aliases: [],
    instruction: {
      usage: '/clearbench [SELECTION|all]',
      description: 'Remove selected members from the bench',
      permission: 'admin',
    },
    stateKeys: ['bench'],
    condition: async (context, state) => {
      const entries = normalizeBenchEntries(state.bench);

      if (entries == null) {
        return { ok: false, code: 'INVALID_BENCH_STATE' };
      }

      if (entries.length === 0 || context.args.length === 0) {
        return { ok: true, mode: 'list', entries, pageIndex: 0 };
      }

      const input = context.args.join(' ').trim();
      const normalizedInput = input.toLowerCase();

      if (normalizedInput === 'all') {
        return { ok: true, mode: 'clearAll', entries };
      }

      if (context.args[0].toLowerCase() === 'page') {
        const pageNumber =
          context.args.length === 2
            ? parsePositiveInteger(context.args[1])
            : null;

        if (pageNumber == null) {
          return { ok: false, code: 'INVALID_SELECTION' };
        }

        return {
          ok: true,
          mode: 'list',
          entries,
          pageIndex: pageNumber - 1,
        };
      }

      const selectedIndices = parseClearbenchSelection(input, entries.length);

      if (selectedIndices == null) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      return {
        ok: true,
        mode: 'remove',
        entries,
        selectedIndices,
      };
    },
    action: async (context, state, condition) => {
      if (condition.entries.length === 0) {
        return { changed: false, code: 'EMPTY_BENCH' };
      }

      if (condition.mode === 'list') {
        return {
          changed: false,
          code: 'SELECTION_READY',
          entries: condition.entries,
          pageIndex: normalizePageIndex(
            condition.pageIndex,
            condition.entries.length
          ),
        };
      }

      if (condition.mode === 'clearAll') {
        return {
          changed: true,
          code: 'ALL_CLEARED',
          changes: { bench: [] },
        };
      }

      const selected = new Set(condition.selectedIndices);
      const removedNames = condition.entries
        .filter(entry => selected.has(entry.index))
        .map(entry => entry.name);
      const bench = state.bench.filter((entry, index) => !selected.has(index));

      return {
        changed: true,
        code: 'MEMBERS_REMOVED',
        changes: { bench },
        removedNames,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(CLEARBENCH_MESSAGES.permissionDenied);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_BENCH_STATE'
      ) {
        return createTextResult(CLEARBENCH_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(CLEARBENCH_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_BENCH') {
        return createTextResult(CLEARBENCH_MESSAGES.empty);
      }

      if (outcome.code === 'INVALID_SELECTION') {
        return createTextResult(CLEARBENCH_MESSAGES.invalidSelection);
      }

      if (outcome.code === 'SELECTION_READY') {
        const totalPages = Math.ceil(
          outcome.entries.length / CLEARBENCH_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          `${CLEARBENCH_MESSAGES.instruction}${pageText}`,
          createSelectionActions(outcome.entries, outcome.pageIndex)
        );
      }

      if (outcome.code === 'ALL_CLEARED') {
        return createTextResult(CLEARBENCH_MESSAGES.clearAllSuccess);
      }

      if (outcome.removedNames.length === 1) {
        return createTextResult(
          CLEARBENCH_MESSAGES.singleSuccess.replace(
            '{name}',
            outcome.removedNames[0]
          )
        );
      }

      return createTextResult(
        CLEARBENCH_MESSAGES.success
          .replace('{count}', outcome.removedNames.length)
          .replace('{names}', outcome.removedNames.join('\n'))
      );
    },
  });
}

module.exports = {
  CLEARBENCH_MESSAGES,
  CLEARBENCH_PAGE_SIZE,
  createClearbenchCommand,
  createSelectionActions,
  parseClearbenchSelection,
};
