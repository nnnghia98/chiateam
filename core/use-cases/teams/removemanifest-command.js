const { createHash } = require('node:crypto');

const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');

const REMOVEMANIFEST_PAGE_SIZE = 10;
const REMOVEMANIFEST_TOKEN_LENGTH = 20;

const REMOVEMANIFEST_MESSAGES = Object.freeze({
  empty: 'Chưa có manifest nào.',
  instruction: '📋 Chọn manifest cần xóa:',
  invalidSelection:
    '⚠️ Số thứ tự manifest không hợp lệ. Dùng /manifests để xem danh sách manifest.',
  staleSelection:
    '⚠️ Manifest này không còn tồn tại. Dùng /removemanifest để tải lại danh sách.',
  success: '✅ Đã xóa manifest: {manifest}',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  loadError: '❌ Không thể tải manifest hiện tại từ API.',
  saveError: '❌ Không thể lưu thay đổi manifest. Vui lòng thử lại.',
});

function parsePositiveInteger(value) {
  const text = String(value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function parseRemovemanifestRequest(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { kind: 'list', pageIndex: 0 };
  }

  if (args.length === 1) {
    const manifestNumber = parsePositiveInteger(args[0]);
    return manifestNumber == null ? null : { kind: 'remove', manifestNumber };
  }

  if (args.length === 2 && String(args[0]).toLowerCase() === 'token') {
    const token = String(args[1]).toLowerCase();
    const isValidToken =
      token.length === REMOVEMANIFEST_TOKEN_LENGTH && /^[a-f0-9]+$/.test(token);

    return isValidToken ? { kind: 'removeToken', token } : null;
  }

  if (args.length === 2 && String(args[0]).toLowerCase() === 'page') {
    const pageNumber = parsePositiveInteger(args[1]);
    return pageNumber == null
      ? null
      : { kind: 'list', pageIndex: pageNumber - 1 };
  }

  return null;
}

function normalizeManifestList(value) {
  if (value == null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const manifests = values.map(manifest => {
    if (
      !manifest ||
      typeof manifest !== 'object' ||
      Array.isArray(manifest) ||
      !['same', 'different'].includes(manifest.relation) ||
      !Array.isArray(manifest.players) ||
      manifest.players.length !== 2
    ) {
      return null;
    }

    const players = manifest.players.map(player => {
      const name = String(player?.name ?? '').trim();

      if (!name) {
        return null;
      }

      const identity = String(player?.identity ?? '').trim();

      return identity ? { identity, name } : { name };
    });

    return players.some(player => player == null)
      ? null
      : { relation: manifest.relation, players };
  });

  return manifests.some(manifest => manifest == null) ? null : manifests;
}

function buildManifestLine(manifest, index = null) {
  const prefix = index == null ? '' : `${index + 1}. `;
  const symbol = manifest.relation === 'same' ? '<3' : '</3';

  return `${prefix}${manifest.players[0].name} ${symbol} ${manifest.players[1].name}`;
}

function createManifestToken(manifest) {
  const players = manifest.players
    .map(player =>
      String(
        player.identity || `name:${player.name.trim().toLowerCase()}`
      ).trim()
    )
    .sort();
  const value = JSON.stringify({ relation: manifest.relation, players });

  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, REMOVEMANIFEST_TOKEN_LENGTH);
}

function normalizePageIndex(pageIndex, totalEntries) {
  const maxPage = Math.max(
    0,
    Math.ceil(totalEntries / REMOVEMANIFEST_PAGE_SIZE) - 1
  );

  return Math.min(Math.max(pageIndex, 0), maxPage);
}

function createSelectionActions(manifests, pageIndex) {
  const currentPage = normalizePageIndex(pageIndex, manifests.length);
  const start = currentPage * REMOVEMANIFEST_PAGE_SIZE;
  const actions = manifests
    .slice(start, start + REMOVEMANIFEST_PAGE_SIZE)
    .map((manifest, offset) => {
      const index = start + offset;
      const token = createManifestToken(manifest);

      return {
        id: `removemanifest_remove_${token}`,
        label: buildManifestLine(manifest, index),
        command: `/removemanifest token ${token}`,
      };
    });
  const totalPages = Math.ceil(manifests.length / REMOVEMANIFEST_PAGE_SIZE);

  if (currentPage > 0) {
    actions.push({
      id: `removemanifest_page_${currentPage}`,
      label: '< Trước',
      command: `/removemanifest page ${currentPage}`,
    });
  }

  if (currentPage + 1 < totalPages) {
    actions.push({
      id: `removemanifest_page_${currentPage + 2}`,
      label: 'Tiếp >',
      command: `/removemanifest page ${currentPage + 2}`,
    });
  }

  return actions;
}

function createRemovemanifestCommand() {
  return createCommandDefinition({
    name: 'removemanifest',
    aliases: [],
    instruction: {
      usage: '/removemanifest [NUMBER]',
      description: 'Remove one team constraint',
      permission: 'admin',
    },
    stateKeys: ['manifest'],
    condition: async (context, state) => {
      const manifests = normalizeManifestList(state.manifest);

      if (manifests == null) {
        return { ok: false, code: 'INVALID_MANIFEST_STATE' };
      }

      const request = parseRemovemanifestRequest(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_SELECTION' };
      }

      if (manifests.length === 0) {
        return {
          ok: false,
          code:
            request.kind === 'removeToken'
              ? 'STALE_SELECTION'
              : 'EMPTY_MANIFESTS',
        };
      }

      if (request.kind === 'remove') {
        if (request.manifestNumber > manifests.length) {
          return { ok: false, code: 'INVALID_SELECTION' };
        }

        return {
          ok: true,
          manifests,
          request,
          manifestIndex: request.manifestNumber - 1,
        };
      }

      if (request.kind === 'removeToken') {
        const manifestIndex = manifests.findIndex(
          manifest => createManifestToken(manifest) === request.token
        );

        if (manifestIndex === -1) {
          return { ok: false, code: 'STALE_SELECTION' };
        }

        return { ok: true, manifests, request, manifestIndex };
      }

      return { ok: true, manifests, request };
    },
    action: async (context, state, condition) => {
      if (condition.request.kind === 'list') {
        return {
          changed: false,
          code: 'SELECTION_READY',
          manifests: condition.manifests,
          pageIndex: normalizePageIndex(
            condition.request.pageIndex,
            condition.manifests.length
          ),
        };
      }

      const { manifestIndex } = condition;
      const removedManifest = condition.manifests[manifestIndex];
      const nextManifests = condition.manifests.filter(
        (_, index) => index !== manifestIndex
      );

      return {
        changed: true,
        code: 'MANIFEST_REMOVED',
        changes: { manifest: nextManifests.length > 0 ? nextManifests : null },
        removedManifest,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createTextResult(REMOVEMANIFEST_MESSAGES.permissionDenied);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_MANIFEST_STATE'
      ) {
        return createTextResult(REMOVEMANIFEST_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createTextResult(REMOVEMANIFEST_MESSAGES.saveError);
      }

      if (outcome.code === 'EMPTY_MANIFESTS') {
        return createTextResult(REMOVEMANIFEST_MESSAGES.empty);
      }

      if (outcome.code === 'INVALID_SELECTION') {
        return createTextResult(REMOVEMANIFEST_MESSAGES.invalidSelection);
      }

      if (outcome.code === 'STALE_SELECTION') {
        return createTextResult(REMOVEMANIFEST_MESSAGES.staleSelection);
      }

      if (outcome.code === 'SELECTION_READY') {
        const totalPages = Math.ceil(
          outcome.manifests.length / REMOVEMANIFEST_PAGE_SIZE
        );
        const pageText =
          totalPages > 1
            ? `\nTrang ${outcome.pageIndex + 1}/${totalPages}`
            : '';

        return createTextResult(
          `${REMOVEMANIFEST_MESSAGES.instruction}${pageText}`,
          createSelectionActions(outcome.manifests, outcome.pageIndex)
        );
      }

      return createTextResult(
        REMOVEMANIFEST_MESSAGES.success.replace(
          '{manifest}',
          buildManifestLine(outcome.removedManifest)
        )
      );
    },
  });
}

module.exports = {
  REMOVEMANIFEST_MESSAGES,
  REMOVEMANIFEST_PAGE_SIZE,
  REMOVEMANIFEST_TOKEN_LENGTH,
  buildManifestLine,
  createManifestToken,
  createRemovemanifestCommand,
  createSelectionActions,
  normalizeManifestList,
  parseRemovemanifestRequest,
};
