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
  targetPrompt: '⚽ Chọn team cần thêm member:',
  instruction: '📋 Chọn member để thêm vào {team}:',
  invalidSelection: '⚠️ Lựa chọn không hợp lệ. Vui lòng chọn lại từ menu.',
  allDuplicates: '⚠️ Tất cả {count} member đã có trong {team} rồi.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải bench hoặc team hiện tại từ API.',
  saveError: '❌ Không thể lưu thay đổi team. Vui lòng thử lại.',
});

function parseAddtoteamRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'chooseTarget' };
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

function createTargetActions() {
  return [
    {
      id: 'addtoteam_2_home',
      label: '2 team · HOME',
      command: '/addtoteam 2 HOME',
    },
    {
      id: 'addtoteam_2_away',
      label: '2 team · AWAY',
      command: '/addtoteam 2 AWAY',
    },
    {
      id: 'addtoteam_3_home',
      label: '3 team · HOME',
      command: '/addtoteam 3 HOME',
    },
    {
      id: 'addtoteam_3_away',
      label: '3 team · AWAY',
      command: '/addtoteam 3 AWAY',
    },
    {
      id: 'addtoteam_3_extra',
      label: '3 team · EXTRA',
      command: '/addtoteam 3 EXTRA',
    },
  ];
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
      const request = parseAddtoteamRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      const bench = normalizeBenchEntries(state.bench);

      if (bench == null) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
      }

      if (bench.length === 0) {
        return { ok: false, code: 'EMPTY_BENCH' };
      }

      if (request.kind === 'chooseTarget') {
        return { ok: true, request };
      }

      const targetTeam = normalizeBenchEntries(state[request.target.key]);

      if (targetTeam == null) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
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

      if (request.kind === 'chooseTarget') {
        return { changed: false, code: 'TARGET_REQUESTED' };
      }

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

      if (outcome.code === 'INVALID_REQUEST') {
        return createTextResult(ADDTOTEAM_MESSAGES.invalidSelection);
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

      if (outcome.code === 'TARGET_REQUESTED') {
        return createTextResult(
          ADDTOTEAM_MESSAGES.targetPrompt,
          createTargetActions()
        );
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
  createTargetActions,
  getTeamTarget,
  parseAddtoteamRequest,
  parseMemberSelection,
};
