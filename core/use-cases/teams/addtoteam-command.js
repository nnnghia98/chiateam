const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { normalizeBenchEntries } = require('../bench/bench-member');
const {
  parseMemberSelection,
  parsePositiveInteger,
} = require('./member-selection');
const { createTeamEntryKey, getMemberIdentity } = require('./team-assignment');
const { TEAM_TARGETS, getTeamTarget } = require('./team-targets');

const ADDTOTEAM_PAGE_SIZE = 10;
const ADDTOTEAM_STATE_KEYS = Object.freeze([
  'bench',
  'teamA',
  'teamB',
  'team3A',
  'team3B',
  'team3C',
]);

const ADDTOTEAM_MESSAGES = Object.freeze({
  emptyBench: '⚠️ Bench trống. Thêm member trước.',
  usage:
    '📋 Cách sử dụng /addtoteam:\n' +
    '• /addtoteam HOME - Chọn member thêm vào Home\n' +
    '• /addtoteam AWAY - Chọn member thêm vào Away\n' +
    '• /addtoteam 3 EXTRA - Chọn member thêm vào Extra\n' +
    '• /addtoteam [2|3] HOME|AWAY|EXTRA all - Thêm tất cả',
  instruction: '📋 Chọn member để thêm vào {team}:',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n' +
    '/addtoteam HOME 1,3,5 hoặc /addtoteam 3 HOME 1-3 hoặc ' +
    '/addtoteam HOME all',
  allDuplicates: '⚠️ Tất cả {count} member đã có trong {team} rồi.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải bench hoặc team hiện tại từ API.',
  saveError: '❌ Không thể lưu thay đổi team. Vui lòng thử lại.',
});

function parseAddtoteamRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return null;
  }

  let mode = 2;
  let teamIndex = 0;

  if (args[0] === '2' || args[0] === '3') {
    mode = Number(args[0]);
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

  return { kind: 'add', mode, teamType, target, selection };
}

function normalizePageIndex(pageIndex, totalEntries) {
  const maxPage = Math.max(
    0,
    Math.ceil(totalEntries / ADDTOTEAM_PAGE_SIZE) - 1
  );

  return Math.min(Math.max(pageIndex, 0), maxPage);
}

function createSelectionActions(entries, request) {
  const pageIndex = normalizePageIndex(request.pageIndex, entries.length);
  const start = pageIndex * ADDTOTEAM_PAGE_SIZE;
  const commandPrefix = `/addtoteam ${request.mode} ${request.teamType}`;
  const actions = entries
    .slice(start, start + ADDTOTEAM_PAGE_SIZE)
    .map(entry => {
      const number = entry.index + 1;

      return {
        id: `addtoteam_select_${request.mode}_${request.teamType}_${number}`,
        label: `${number}. ${entry.name}`,
        command: `${commandPrefix} ${number}`,
      };
    });
  const totalPages = Math.ceil(entries.length / ADDTOTEAM_PAGE_SIZE);

  if (pageIndex > 0) {
    actions.push({
      id: `addtoteam_page_${request.mode}_${request.teamType}_${pageIndex}`,
      label: '< Trước',
      command: `${commandPrefix} page ${pageIndex}`,
    });
  }

  if (pageIndex + 1 < totalPages) {
    actions.push({
      id: `addtoteam_page_${request.mode}_${request.teamType}_${pageIndex + 2}`,
      label: 'Tiếp >',
      command: `${commandPrefix} page ${pageIndex + 2}`,
    });
  }

  return actions;
}

function buildSuccessSegments(outcome) {
  const segments = [];

  if (outcome.duplicateNames.length > 0) {
    segments.push({
      text:
        `⚠️ Đã bỏ qua ${outcome.duplicateNames.length} member đã có trong ` +
        `${outcome.teamLabel}:\n${outcome.duplicateNames.join(', ')}\n\n`,
    });
  }

  segments.push(
    {
      text:
        `✅ Đã thêm ${outcome.addedNames.length} member(s) vào ` +
        `${outcome.teamLabel}:\n${outcome.addedNames.join('\n')}\n\n👤 `,
    },
    { text: `${outcome.teamLabel} hiện tại:`, bold: true },
    { text: `\n${outcome.teamNames.join('\n')}` }
  );

  return segments;
}

function createAddtoteamCommand() {
  return createCommandDefinition({
    name: 'addtoteam',
    aliases: [],
    instruction: {
      usage: '/addtoteam [2|3] HOME|AWAY|EXTRA [SELECTION]',
      description: 'Add selected bench members to a team',
      permission: 'admin',
    },
    stateKeys: ADDTOTEAM_STATE_KEYS,
    condition: async (context, state) => {
      if (context.args.length === 0) {
        return { ok: false, code: 'USAGE' };
      }

      const request = parseAddtoteamRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      const bench = normalizeBenchEntries(state.bench);
      const targetTeam = normalizeBenchEntries(state[request.target.key]);

      if (bench == null || targetTeam == null) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
      }

      if (bench.length === 0) {
        return { ok: false, code: 'EMPTY_BENCH' };
      }

      if (request.kind === 'list') {
        return { ok: true, request, bench };
      }

      const selectedEntries = parseMemberSelection(request.selection, bench);

      if (selectedEntries == null) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      return { ok: true, request, bench, selectedEntries };
    },
    action: async (context, state, condition) => {
      const { request } = condition;

      if (request.kind === 'list') {
        return {
          changed: false,
          code: 'SELECTION_READY',
          entries: condition.bench,
          request: {
            ...request,
            pageIndex: normalizePageIndex(
              request.pageIndex,
              condition.bench.length
            ),
          },
        };
      }

      const team = state[request.target.key].map(([key, member]) => [
        key,
        member,
      ]);
      const identities = new Set(
        team.map(([, member]) => getMemberIdentity(member))
      );
      const addedNames = [];
      const duplicateNames = [];

      condition.selectedEntries.forEach(entry => {
        const identity = getMemberIdentity(entry.member);

        if (identities.has(identity)) {
          duplicateNames.push(entry.name);
          return;
        }

        team.push([
          createTeamEntryKey({ entries: team }, identity),
          entry.member,
        ]);
        identities.add(identity);
        addedNames.push(entry.name);
      });

      if (addedNames.length === 0) {
        return {
          changed: false,
          code: 'ALL_DUPLICATES',
          duplicateNames,
          teamLabel: request.target.label,
        };
      }

      return {
        changed: true,
        code: 'MEMBERS_ADDED',
        changes: { [request.target.key]: team },
        addedNames,
        duplicateNames,
        teamLabel: request.target.label,
        teamNames: team.map(([, member]) =>
          typeof member === 'string' ? member : member.name
        ),
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(ADDTOTEAM_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'USAGE' || outcome.code === 'INVALID_REQUEST') {
        return createTextResult(ADDTOTEAM_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_TEAM_STATE'
      ) {
        return createTextResult(ADDTOTEAM_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(ADDTOTEAM_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_BENCH') {
        return createTextResult(ADDTOTEAM_MESSAGES.emptyBench);
      }

      if (outcome.code === 'INVALID_SELECTION') {
        return createTextResult(ADDTOTEAM_MESSAGES.invalidSelection);
      }

      if (outcome.code === 'SELECTION_READY') {
        const totalPages = Math.ceil(
          outcome.entries.length / ADDTOTEAM_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.request.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          ADDTOTEAM_MESSAGES.instruction.replace(
            '{team}',
            outcome.request.target.label
          ) + pageText,
          createSelectionActions(outcome.entries, outcome.request)
        );
      }

      if (outcome.code === 'ALL_DUPLICATES') {
        return createTextResult(
          ADDTOTEAM_MESSAGES.allDuplicates
            .replace('{count}', outcome.duplicateNames.length)
            .replace('{team}', outcome.teamLabel)
        );
      }

      return createRichTextResult(buildSuccessSegments(outcome));
    },
  });
}

module.exports = {
  ADDTOTEAM_MESSAGES,
  ADDTOTEAM_PAGE_SIZE,
  ADDTOTEAM_STATE_KEYS,
  TEAM_TARGETS,
  buildSuccessSegments,
  createAddtoteamCommand,
  createSelectionActions,
  getTeamTarget,
  parseAddtoteamRequest,
  parseMemberSelection,
};
