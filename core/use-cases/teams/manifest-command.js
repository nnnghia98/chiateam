const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { normalizeBenchEntries } = require('../bench/bench-member');
const { normalizeManifestList, upsertManifest } = require('./manifest-rules');
const { parsePositiveInteger } = require('./member-selection');
const { getMemberIdentity } = require('./team-assignment');

const MANIFEST_PAGE_SIZE = 10;
const MANIFEST_STATE_KEYS = Object.freeze(['bench', 'manifest']);

const MANIFEST_MESSAGES = Object.freeze({
  emptyBench: '⚠️ Bench trống. Thêm member trước.',
  notEnough: '⚠️ Cần ít nhất 2 member trong bench để tạo manifest.',
  noCurrent: 'Chưa có manifest nào.',
  instruction: '📋 Chọn member đầu tiên cho manifest:',
  relationPrompt: 'Chọn quan hệ cho {first}:',
  secondPlayerPrompt: 'Chọn member thứ hai cho {first} {symbol}:',
  invalidSelection:
    '⚠️ Cú pháp manifest không hợp lệ. Ví dụ:\n' +
    '/manifest 1 SAME 3 hoặc /manifest 1 DIFFERENT 3',
  success: '🧞‍♂️ Đã nhận nguyện vọng: {first} {symbol} {second}',
  replaceSuccess: '♻️ Đã cập nhật nguyện vọng: {first} {symbol} {second}',
  conflict:
    '⚠️ Manifest này mâu thuẫn với danh sách hiện tại. Dùng /manifests để xem hoặc /removemanifest [số thứ tự] để xóa manifest cũ.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải bench hoặc manifest hiện tại từ API.',
  saveError: '❌ Không thể lưu manifest. Vui lòng thử lại.',
});

function parseManifestRelation(value) {
  const token = String(value ?? '').trim();
  const word = token.toUpperCase();

  if (word === 'SAME' || ['<3', '❤️', '❤'].includes(token)) {
    return {
      relation: 'same',
      symbol: word === 'SAME' ? '<3' : token,
    };
  }

  if (word === 'DIFFERENT' || ['</3', '💔'].includes(token)) {
    return {
      relation: 'different',
      symbol: word === 'DIFFERENT' ? '</3' : token,
    };
  }

  return null;
}

function parseManifestRequest(args) {
  if (!Array.isArray(args)) {
    return null;
  }

  if (args.length === 0) {
    return { kind: 'listFirst', pageIndex: 0 };
  }

  if (args.length === 2 && args[0].toLowerCase() === 'page') {
    const pageNumber = parsePositiveInteger(args[1]);

    return pageNumber == null
      ? null
      : { kind: 'listFirst', pageIndex: pageNumber - 1 };
  }

  const firstNumber = parsePositiveInteger(args[0]);

  if (firstNumber == null) {
    return null;
  }

  if (args.length === 1) {
    return { kind: 'chooseRelation', firstNumber };
  }

  const parsedRelation = parseManifestRelation(args[1]);

  if (!parsedRelation) {
    return null;
  }

  if (args.length === 2) {
    return {
      kind: 'listSecond',
      firstNumber,
      ...parsedRelation,
      pageIndex: 0,
    };
  }

  if (args.length === 4 && args[2].toLowerCase() === 'page') {
    const pageNumber = parsePositiveInteger(args[3]);

    return pageNumber == null
      ? null
      : {
          kind: 'listSecond',
          firstNumber,
          ...parsedRelation,
          pageIndex: pageNumber - 1,
        };
  }

  if (args.length === 3) {
    const secondNumber = parsePositiveInteger(args[2]);

    return secondNumber == null
      ? null
      : {
          kind: 'save',
          firstNumber,
          secondNumber,
          ...parsedRelation,
        };
  }

  return null;
}

function normalizePageIndex(pageIndex, totalEntries) {
  const maxPage = Math.max(0, Math.ceil(totalEntries / MANIFEST_PAGE_SIZE) - 1);

  return Math.min(Math.max(pageIndex, 0), maxPage);
}

function getManifestSymbol(relation) {
  return relation === 'same' ? '<3' : '</3';
}

function buildManifestLines(manifests) {
  return manifests.map((manifest, index) => {
    const [first, second] = manifest.players;
    const firstName = first.name || first.identity;
    const secondName = second.name || second.identity;

    return `${index + 1}. ${firstName} ${getManifestSymbol(
      manifest.relation
    )} ${secondName}`;
  });
}

function buildCurrentManifestText(manifests) {
  return manifests.length === 0
    ? MANIFEST_MESSAGES.noCurrent
    : `Manifest hiện tại:\n${buildManifestLines(manifests).join('\n')}`;
}

function createRelationActions(firstNumber) {
  return [
    {
      id: `manifest_same_${firstNumber}`,
      label: 'Cùng team <3',
      command: `/manifest ${firstNumber} SAME`,
    },
    {
      id: `manifest_different_${firstNumber}`,
      label: 'Khác team </3',
      command: `/manifest ${firstNumber} DIFFERENT`,
    },
  ];
}

function createMemberActions(entries, request) {
  const isSecondSelection = request.kind === 'listSecond';
  const candidates = isSecondSelection
    ? entries.filter(entry => entry.index + 1 !== request.firstNumber)
    : entries;
  const pageIndex = normalizePageIndex(request.pageIndex, candidates.length);
  const start = pageIndex * MANIFEST_PAGE_SIZE;
  const relationWord = request.relation?.toUpperCase();
  const actions = candidates
    .slice(start, start + MANIFEST_PAGE_SIZE)
    .map(entry => {
      const number = entry.index + 1;
      const command = isSecondSelection
        ? `/manifest ${request.firstNumber} ${relationWord} ${number}`
        : `/manifest ${number}`;

      return {
        id: isSecondSelection
          ? `manifest_second_${request.firstNumber}_${request.relation}_${number}`
          : `manifest_first_${number}`,
        label: `${number}. ${entry.name}`,
        command,
      };
    });
  const totalPages = Math.ceil(candidates.length / MANIFEST_PAGE_SIZE);
  const pageCommand = pageNumber =>
    isSecondSelection
      ? `/manifest ${request.firstNumber} ${relationWord} page ${pageNumber}`
      : `/manifest page ${pageNumber}`;

  if (pageIndex > 0) {
    actions.push({
      id: `manifest_${isSecondSelection ? 'second' : 'first'}_page_${pageIndex}`,
      label: '< Trước',
      command: pageCommand(pageIndex),
    });
  }

  if (pageIndex + 1 < totalPages) {
    actions.push({
      id: `manifest_${isSecondSelection ? 'second' : 'first'}_page_${pageIndex + 2}`,
      label: 'Tiếp >',
      command: pageCommand(pageIndex + 2),
    });
  }

  return actions;
}

function createManifestCommand() {
  return createCommandDefinition({
    name: 'manifest',
    aliases: [],
    instruction: {
      usage: '/manifest [FIRST SAME|DIFFERENT SECOND]',
      description: 'Add or replace one team constraint',
      permission: 'admin',
    },
    stateKeys: MANIFEST_STATE_KEYS,
    condition: async (context, state) => {
      const request = parseManifestRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      const entries = normalizeBenchEntries(state.bench);
      const manifests = normalizeManifestList(state.manifest);

      if (entries == null || manifests == null) {
        return { ok: false, code: 'INVALID_MANIFEST_STATE' };
      }

      if (entries.length === 0) {
        return { ok: false, code: 'EMPTY_BENCH', manifests };
      }

      if (entries.length < 2) {
        return { ok: false, code: 'NOT_ENOUGH_MEMBERS' };
      }

      if (request.kind === 'listFirst') {
        return { ok: true, request, entries, manifests };
      }

      const first = entries[request.firstNumber - 1];

      if (!first) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      if (request.kind === 'chooseRelation') {
        return { ok: true, request, first };
      }

      if (request.kind === 'listSecond') {
        return { ok: true, request, entries, first };
      }

      const second = entries[request.secondNumber - 1];

      if (
        !second ||
        first.index === second.index ||
        getMemberIdentity(first.member) === getMemberIdentity(second.member)
      ) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      const nextManifest = {
        relation: request.relation,
        players: [first, second].map(entry => ({
          identity: getMemberIdentity(entry.member),
          name: entry.name,
        })),
      };
      const result = upsertManifest(manifests, nextManifest);

      if (!result.isValid) {
        return { ok: false, code: 'MANIFEST_CONFLICT' };
      }

      return { ok: true, request, first, second, result };
    },
    action: async (context, state, condition) => {
      const { request } = condition;

      if (request.kind === 'listFirst') {
        return {
          changed: false,
          code: 'FIRST_SELECTION_READY',
          entries: condition.entries,
          manifests: condition.manifests,
          request: {
            ...request,
            pageIndex: normalizePageIndex(
              request.pageIndex,
              condition.entries.length
            ),
          },
        };
      }

      if (request.kind === 'chooseRelation') {
        return {
          changed: false,
          code: 'RELATION_SELECTION_READY',
          first: condition.first,
        };
      }

      if (request.kind === 'listSecond') {
        return {
          changed: false,
          code: 'SECOND_SELECTION_READY',
          entries: condition.entries,
          first: condition.first,
          request: {
            ...request,
            pageIndex: normalizePageIndex(
              request.pageIndex,
              condition.entries.length - 1
            ),
          },
        };
      }

      return {
        changed: true,
        code: condition.result.isReplacement
          ? 'MANIFEST_REPLACED'
          : 'MANIFEST_ADDED',
        changes: { manifest: condition.result.manifests },
        firstName: condition.first.name,
        secondName: condition.second.name,
        symbol: request.symbol,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(MANIFEST_MESSAGES.permissionDenied);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_MANIFEST_STATE'
      ) {
        return createTextResult(MANIFEST_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(MANIFEST_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_BENCH') {
        return createTextResult(
          `${MANIFEST_MESSAGES.emptyBench}\n\n${buildCurrentManifestText(
            outcome.manifests
          )}`
        );
      }

      if (outcome.code === 'NOT_ENOUGH_MEMBERS') {
        return createTextResult(MANIFEST_MESSAGES.notEnough);
      }

      if (outcome.code === 'INVALID_SELECTION') {
        return createTextResult(MANIFEST_MESSAGES.invalidSelection);
      }

      if (outcome.code === 'MANIFEST_CONFLICT') {
        return createTextResult(MANIFEST_MESSAGES.conflict);
      }

      if (outcome.code === 'FIRST_SELECTION_READY') {
        const totalPages = Math.ceil(
          outcome.entries.length / MANIFEST_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.request.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          `${MANIFEST_MESSAGES.instruction}${pageText}\n\n${buildCurrentManifestText(
            outcome.manifests
          )}`,
          createMemberActions(outcome.entries, outcome.request)
        );
      }

      if (outcome.code === 'RELATION_SELECTION_READY') {
        return createTextResult(
          MANIFEST_MESSAGES.relationPrompt.replace(
            '{first}',
            outcome.first.name
          ),
          createRelationActions(outcome.first.index + 1)
        );
      }

      if (outcome.code === 'SECOND_SELECTION_READY') {
        const totalPages = Math.ceil(
          (outcome.entries.length - 1) / MANIFEST_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.request.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          MANIFEST_MESSAGES.secondPlayerPrompt
            .replace('{first}', outcome.first.name)
            .replace('{symbol}', outcome.request.symbol) + pageText,
          createMemberActions(outcome.entries, outcome.request)
        );
      }

      const template =
        outcome.code === 'MANIFEST_REPLACED'
          ? MANIFEST_MESSAGES.replaceSuccess
          : MANIFEST_MESSAGES.success;

      return createTextResult(
        template
          .replace('{first}', outcome.firstName)
          .replace('{symbol}', outcome.symbol)
          .replace('{second}', outcome.secondName)
      );
    },
  });
}

module.exports = {
  MANIFEST_MESSAGES,
  MANIFEST_PAGE_SIZE,
  MANIFEST_STATE_KEYS,
  buildCurrentManifestText,
  buildManifestLines,
  createManifestCommand,
  createMemberActions,
  createRelationActions,
  parseManifestRelation,
  parseManifestRequest,
};
