const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { normalizeBenchEntries } = require('../bench/bench-member');
const {
  parseMemberSelection,
  parsePositiveInteger,
} = require('./member-selection');
const { getTeamStackKeys, getTeamTarget } = require('./team-targets');

const CLEARTEAM_PAGE_SIZE = 10;
const CLEARTEAM_STATE_KEYS = Object.freeze([
  'teamA',
  'teamB',
  'team3A',
  'team3B',
  'team3C',
]);

const CLEARTEAM_MESSAGES = Object.freeze({
  usage:
    '📋 Cách sử dụng /clearteam:\n' +
    '• /clearteam 2 - Xóa toàn bộ 2-team stack\n' +
    '• /clearteam 3 - Xóa toàn bộ 3-team stack\n' +
    '• /clearteam HOME - Chọn member để xóa khỏi Home\n' +
    '• /clearteam AWAY - Chọn member để xóa khỏi Away\n' +
    '• /clearteam 3 EXTRA - Chọn member để xóa khỏi Extra',
  confirmation:
    '⚠️ Xóa toàn bộ {mode}-team stack ({teams})?\n' +
    'Dùng /clearteam {mode} confirm để xác nhận.',
  cancelled: '✅ Đã hủy xóa team.',
  stack2Empty: '⚠️ 2-team stack đã trống rồi.',
  stack2Success: '✅ Đã xóa toàn bộ 2-team stack (HOME, AWAY).',
  stack3Empty: '⚠️ 3-team stack đã trống rồi.',
  stack3Success: '✅ Đã xóa toàn bộ 3-team stack (HOME, AWAY, EXTRA).',
  emptyTeam: '⚠️ {team} trống.',
  instruction: '👤 Chọn member cần xóa khỏi {team}:',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n' +
    '/clearteam 2 HOME 1,3,5 hoặc /clearteam 3 HOME 1-3 hoặc ' +
    '/clearteam 2 HOME all',
  removeSuccess: '✅ Đã xóa {count} member(s) khỏi {team}:\n{names}',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải team hiện tại từ API.',
  saveError: '❌ Không thể lưu thay đổi team. Vui lòng thử lại.',
});

function parseClearteamRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return null;
  }

  let mode = 2;
  let teamIndex = 0;

  if (args[0] === '2' || args[0] === '3') {
    mode = Number(args[0]);

    if (args.length === 1) {
      return {
        kind: 'confirmStack',
        mode,
        stackKeys: getTeamStackKeys(mode),
      };
    }

    if (args.length === 2 && args[1].toLowerCase() === 'confirm') {
      return {
        kind: 'clearStack',
        mode,
        stackKeys: getTeamStackKeys(mode),
      };
    }

    if (args.length === 2 && args[1].toLowerCase() === 'cancel') {
      return {
        kind: 'cancelStack',
        mode,
        stackKeys: getTeamStackKeys(mode),
      };
    }

    teamIndex = 1;
  }

  const teamType = String(args[teamIndex] ?? '').toUpperCase();
  const target = getTeamTarget(mode, teamType);

  if (!target) {
    return null;
  }

  const selection = args
    .slice(teamIndex + 1)
    .join(' ')
    .trim();

  if (!selection) {
    return { kind: 'list', mode, teamType, target, pageIndex: 0 };
  }

  const page = selection.match(/^page\s+(\d+)$/i);

  if (page) {
    const pageNumber = parsePositiveInteger(page[1]);

    return pageNumber == null
      ? null
      : {
          kind: 'list',
          mode,
          teamType,
          target,
          pageIndex: pageNumber - 1,
        };
  }

  return { kind: 'remove', mode, teamType, target, selection };
}

function normalizePageIndex(pageIndex, totalEntries) {
  const maxPage = Math.max(
    0,
    Math.ceil(totalEntries / CLEARTEAM_PAGE_SIZE) - 1
  );

  return Math.min(Math.max(pageIndex, 0), maxPage);
}

function createConfirmationActions(mode) {
  return [
    {
      id: `clearteam_confirm_${mode}`,
      label: '✅ Xác nhận',
      command: `/clearteam ${mode} confirm`,
    },
    {
      id: `clearteam_cancel_${mode}`,
      label: 'Hủy',
      command: `/clearteam ${mode} cancel`,
    },
  ];
}

function createSelectionActions(entries, request) {
  const pageIndex = normalizePageIndex(request.pageIndex, entries.length);
  const start = pageIndex * CLEARTEAM_PAGE_SIZE;
  const commandPrefix = `/clearteam ${request.mode} ${request.teamType}`;
  const actions = entries
    .slice(start, start + CLEARTEAM_PAGE_SIZE)
    .map(entry => {
      const number = entry.index + 1;

      return {
        id: `clearteam_select_${request.mode}_${request.teamType}_${number}`,
        label: `${number}. ${entry.name}`,
        command: `${commandPrefix} ${number}`,
      };
    });
  const totalPages = Math.ceil(entries.length / CLEARTEAM_PAGE_SIZE);

  if (pageIndex > 0) {
    actions.push({
      id: `clearteam_page_${request.mode}_${request.teamType}_${pageIndex}`,
      label: '< Trước',
      command: `${commandPrefix} page ${pageIndex}`,
    });
  }

  if (pageIndex + 1 < totalPages) {
    actions.push({
      id: `clearteam_page_${request.mode}_${request.teamType}_${pageIndex + 2}`,
      label: 'Tiếp >',
      command: `${commandPrefix} page ${pageIndex + 2}`,
    });
  }

  return actions;
}

function getStackNames(mode) {
  return mode === 3 ? 'HOME, AWAY, EXTRA' : 'HOME, AWAY';
}

function createClearteamCommand() {
  return createCommandDefinition({
    name: 'clearteam',
    aliases: [],
    instruction: {
      usage: '/clearteam MODE [TEAM] [SELECTION|confirm]',
      description: 'Remove team members or clear a confirmed team stack',
      permission: 'admin',
    },
    stateKeys: CLEARTEAM_STATE_KEYS,
    condition: async (context, state) => {
      if (context.args.length === 0) {
        return { ok: false, code: 'USAGE' };
      }

      const request = parseClearteamRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      if (request.kind === 'cancelStack') {
        return { ok: true, request };
      }

      if (request.stackKeys) {
        const stacks = request.stackKeys.map(key =>
          normalizeBenchEntries(state[key])
        );

        if (stacks.some(entries => entries == null)) {
          return { ok: false, code: 'INVALID_TEAM_STATE' };
        }

        if (stacks.every(entries => entries.length === 0)) {
          return { ok: false, code: 'EMPTY_STACK', mode: request.mode };
        }

        return { ok: true, request };
      }

      const entries = normalizeBenchEntries(state[request.target.key]);

      if (entries == null) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
      }

      if (entries.length === 0) {
        return {
          ok: false,
          code: 'EMPTY_TEAM',
          teamLabel: request.target.label,
        };
      }

      if (request.kind === 'list') {
        return { ok: true, request, entries };
      }

      const selectedEntries = parseMemberSelection(request.selection, entries);

      if (selectedEntries == null) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      return { ok: true, request, entries, selectedEntries };
    },
    action: async (context, state, condition) => {
      const { request } = condition;

      if (request.kind === 'cancelStack') {
        return { changed: false, code: 'STACK_CLEAR_CANCELLED' };
      }

      if (request.kind === 'confirmStack') {
        return {
          changed: false,
          code: 'STACK_CONFIRMATION_REQUIRED',
          mode: request.mode,
        };
      }

      if (request.kind === 'clearStack') {
        return {
          changed: true,
          code: 'STACK_CLEARED',
          changes: Object.fromEntries(request.stackKeys.map(key => [key, []])),
          mode: request.mode,
        };
      }

      if (request.kind === 'list') {
        return {
          changed: false,
          code: 'SELECTION_READY',
          entries: condition.entries,
          request: {
            ...request,
            pageIndex: normalizePageIndex(
              request.pageIndex,
              condition.entries.length
            ),
          },
        };
      }

      const selectedIndices = new Set(
        condition.selectedEntries.map(entry => entry.index)
      );
      const team = state[request.target.key].filter(
        (entry, index) => !selectedIndices.has(index)
      );
      const removedNames = condition.selectedEntries.map(entry => entry.name);

      return {
        changed: true,
        code: 'MEMBERS_REMOVED',
        changes: { [request.target.key]: team },
        removedNames,
        teamLabel: request.target.label,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(CLEARTEAM_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'USAGE' || outcome.code === 'INVALID_REQUEST') {
        return createTextResult(CLEARTEAM_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_TEAM_STATE'
      ) {
        return createTextResult(CLEARTEAM_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(CLEARTEAM_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_STACK') {
        return createTextResult(
          outcome.mode === 3
            ? CLEARTEAM_MESSAGES.stack3Empty
            : CLEARTEAM_MESSAGES.stack2Empty
        );
      }

      if (outcome.code === 'EMPTY_TEAM') {
        return createTextResult(
          CLEARTEAM_MESSAGES.emptyTeam.replace('{team}', outcome.teamLabel)
        );
      }

      if (outcome.code === 'INVALID_SELECTION') {
        return createTextResult(CLEARTEAM_MESSAGES.invalidSelection);
      }

      if (outcome.code === 'STACK_CLEAR_CANCELLED') {
        return createTextResult(CLEARTEAM_MESSAGES.cancelled);
      }

      if (outcome.code === 'STACK_CONFIRMATION_REQUIRED') {
        return createTextResult(
          CLEARTEAM_MESSAGES.confirmation
            .replaceAll('{mode}', outcome.mode)
            .replace('{teams}', getStackNames(outcome.mode)),
          createConfirmationActions(outcome.mode)
        );
      }

      if (outcome.code === 'STACK_CLEARED') {
        return createTextResult(
          outcome.mode === 3
            ? CLEARTEAM_MESSAGES.stack3Success
            : CLEARTEAM_MESSAGES.stack2Success
        );
      }

      if (outcome.code === 'SELECTION_READY') {
        const totalPages = Math.ceil(
          outcome.entries.length / CLEARTEAM_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.request.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          CLEARTEAM_MESSAGES.instruction.replace(
            '{team}',
            outcome.request.target.label
          ) + pageText,
          createSelectionActions(outcome.entries, outcome.request)
        );
      }

      return createTextResult(
        CLEARTEAM_MESSAGES.removeSuccess
          .replace('{count}', outcome.removedNames.length)
          .replace('{team}', outcome.teamLabel)
          .replace('{names}', outcome.removedNames.join('\n'))
      );
    },
  });
}

module.exports = {
  CLEARTEAM_MESSAGES,
  CLEARTEAM_PAGE_SIZE,
  CLEARTEAM_STATE_KEYS,
  createClearteamCommand,
  createConfirmationActions,
  createSelectionActions,
  parseClearteamRequest,
};
