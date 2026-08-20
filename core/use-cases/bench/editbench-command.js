const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  getBaseMemberName,
  isValidMemberName,
  normalizeBenchEntries,
  normalizeName,
} = require('./bench-member');

const EDITBENCH_PAGE_SIZE = 10;

const EDITBENCH_MESSAGES = Object.freeze({
  empty: '⚠️ Bench trống.',
  instruction: '📋 Chọn member cần đổi tên:',
  namePrompt: '✏️ Nhập tên mới cho {name}.',
  fallback: 'Hoặc dùng: /editbench {number} TÊN_MỚI',
  invalidSelection:
    '⚠️ Số thứ tự không hợp lệ. Dùng /editbench để xem danh sách và chọn lại.',
  invalidName: '⚠️ Tên mới không hợp lệ.',
  duplicateName: '⚠️ Tên {name} đã tồn tại trong bench.',
  success: '✅ Đã đổi tên: {oldName} → {newName}',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải bench hiện tại từ API.',
  saveError: '❌ Không thể lưu tên mới. Vui lòng thử lại.',
});

function parsePositiveInteger(value) {
  const text = String(value ?? '');

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizePageIndex(pageIndex, totalEntries) {
  const maxPage = Math.max(
    0,
    Math.ceil(totalEntries / EDITBENCH_PAGE_SIZE) - 1
  );

  return Math.min(Math.max(pageIndex, 0), maxPage);
}

function createSelectionActions(entries, pageIndex) {
  const currentPage = normalizePageIndex(pageIndex, entries.length);
  const start = currentPage * EDITBENCH_PAGE_SIZE;
  const actions = entries
    .slice(start, start + EDITBENCH_PAGE_SIZE)
    .map(entry => {
      const number = entry.index + 1;

      return {
        id: `editbench_select_${number}`,
        label: `${number}. ${entry.name}`,
        command: `/editbench ${number}`,
      };
    });
  const totalPages = Math.ceil(entries.length / EDITBENCH_PAGE_SIZE);

  if (currentPage > 0) {
    actions.push({
      id: `editbench_page_${currentPage}`,
      label: '< Trước',
      command: `/editbench page ${currentPage}`,
    });
  }

  if (currentPage + 1 < totalPages) {
    actions.push({
      id: `editbench_page_${currentPage + 2}`,
      label: 'Tiếp >',
      command: `/editbench page ${currentPage + 2}`,
    });
  }

  return actions;
}

function renameBenchEntry(entry, newName) {
  const [key, member] = entry;

  if (typeof member === 'string') {
    return [key, { name: newName, memberId: `bench:${String(key)}` }];
  }

  const renamedMember = { ...member, name: newName };

  if (renamedMember.userId == null && !renamedMember.memberId) {
    renamedMember.memberId = `bench:${String(key)}`;
  }

  return [key, renamedMember];
}

function createNameInputResult(text, selectedNumber, oldName) {
  const prompt = EDITBENCH_MESSAGES.namePrompt.replace('{name}', oldName);
  const fallback = EDITBENCH_MESSAGES.fallback.replace(
    '{number}',
    selectedNumber
  );

  return createTextResult(
    [text, prompt, fallback].filter(Boolean).join('\n\n'),
    [],
    {
      input: {
        command: 'editbench',
        args: [String(selectedNumber)],
      },
    }
  );
}

function createEditbenchCommand() {
  return createCommandDefinition({
    name: 'editbench',
    aliases: [],
    instruction: {
      usage: '/editbench [NUMBER NEW_NAME]',
      description: 'Rename a bench member',
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

      const selectedNumber = parsePositiveInteger(context.args[0]);

      if (selectedNumber == null || selectedNumber > entries.length) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      const selectedEntry = entries[selectedNumber - 1];

      if (context.args.length === 1) {
        return {
          ok: true,
          mode: 'prompt',
          selectedNumber,
          oldName: selectedEntry.name,
        };
      }

      const newName = normalizeName(context.args.slice(1).join(' '));

      if (!isValidMemberName(newName)) {
        return {
          ok: false,
          code: 'INVALID_NAME',
          selectedNumber,
          oldName: selectedEntry.name,
        };
      }

      const duplicateName = entries.some(
        entry =>
          entry.index !== selectedEntry.index &&
          getBaseMemberName(entry.member).toLowerCase() ===
            newName.toLowerCase()
      );

      if (duplicateName) {
        return {
          ok: false,
          code: 'DUPLICATE_NAME',
          selectedNumber,
          oldName: selectedEntry.name,
          newName,
        };
      }

      return {
        ok: true,
        mode: 'rename',
        selectedNumber,
        oldName: selectedEntry.name,
        newName,
      };
    },
    action: async (context, state, condition) => {
      if (condition.entries?.length === 0) {
        return { changed: false, code: 'EMPTY_BENCH' };
      }

      if (condition.mode === 'list') {
        const pageIndex = normalizePageIndex(
          condition.pageIndex,
          condition.entries.length
        );

        return {
          changed: false,
          code: 'SELECTION_READY',
          entries: condition.entries,
          pageIndex,
        };
      }

      if (condition.mode === 'prompt') {
        return {
          changed: false,
          code: 'NAME_REQUESTED',
          selectedNumber: condition.selectedNumber,
          oldName: condition.oldName,
        };
      }

      const targetIndex = condition.selectedNumber - 1;
      const bench = state.bench.map((entry, index) =>
        index === targetIndex
          ? renameBenchEntry(entry, condition.newName)
          : entry
      );

      return {
        changed: true,
        code: 'MEMBER_RENAMED',
        changes: { bench },
        selectedNumber: condition.selectedNumber,
        oldName: condition.oldName,
        newName: condition.newName,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(EDITBENCH_MESSAGES.permissionDenied);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_BENCH_STATE'
      ) {
        return createTextResult(EDITBENCH_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(EDITBENCH_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_BENCH') {
        return createTextResult(EDITBENCH_MESSAGES.empty);
      }

      if (outcome.code === 'INVALID_SELECTION') {
        return createTextResult(EDITBENCH_MESSAGES.invalidSelection);
      }

      if (outcome.code === 'INVALID_NAME') {
        return createNameInputResult(
          EDITBENCH_MESSAGES.invalidName,
          outcome.selectedNumber,
          outcome.oldName
        );
      }

      if (outcome.code === 'DUPLICATE_NAME') {
        return createNameInputResult(
          EDITBENCH_MESSAGES.duplicateName.replace('{name}', outcome.newName),
          outcome.selectedNumber,
          outcome.oldName
        );
      }

      if (outcome.code === 'SELECTION_READY') {
        const totalPages = Math.ceil(
          outcome.entries.length / EDITBENCH_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          `${EDITBENCH_MESSAGES.instruction}${pageText}`,
          createSelectionActions(outcome.entries, outcome.pageIndex)
        );
      }

      if (outcome.code === 'NAME_REQUESTED') {
        return createNameInputResult(
          '',
          outcome.selectedNumber,
          outcome.oldName
        );
      }

      return createTextResult(
        EDITBENCH_MESSAGES.success
          .replace('{oldName}', outcome.oldName)
          .replace('{newName}', outcome.newName)
      );
    },
  });
}

module.exports = {
  EDITBENCH_MESSAGES,
  EDITBENCH_PAGE_SIZE,
  createEditbenchCommand,
  createSelectionActions,
  renameBenchEntry,
};
