const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');

const MANIFESTS_MESSAGES = Object.freeze({
  empty: 'Chưa có manifest nào.',
  usage: '⚠️ Dùng /manifests để xem danh sách manifest.',
  loadError: '❌ Không thể tải manifest hiện tại từ API.',
  aliasNotice: '⚠️ /mf sẽ được thay thế. Hãy dùng /manifests.',
});

function normalizeManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  if (!Array.isArray(value.players) || value.players.length !== 2) {
    return null;
  }

  const players = value.players.map(player => {
    const name = String(player?.name ?? '').trim();
    return name ? { name } : null;
  });

  if (players.some(player => player == null)) {
    return null;
  }

  return {
    relation: value.relation === 'different' ? 'different' : 'same',
    players,
  };
}

function normalizeManifestList(value) {
  if (value == null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const manifests = values.map(normalizeManifest);

  return manifests.some(manifest => manifest == null) ? null : manifests;
}

function buildManifestLines(manifests) {
  return manifests.map((manifest, index) => {
    const symbol = manifest.relation === 'same' ? '<3' : '</3';
    return `${index + 1}. ${manifest.players[0].name} ${symbol} ${manifest.players[1].name}`;
  });
}

function createManifestListResult(manifests, showAliasNotice) {
  const notice = showAliasNotice
    ? [{ text: `${MANIFESTS_MESSAGES.aliasNotice}\n\n` }]
    : [];

  if (manifests.length === 0) {
    return createRichTextResult([
      ...notice,
      { text: MANIFESTS_MESSAGES.empty },
    ]);
  }

  return createRichTextResult([
    ...notice,
    { text: '📋 ' },
    { text: 'Danh sách manifest:', bold: true },
    { text: `\n\n${buildManifestLines(manifests).join('\n')}` },
  ]);
}

function createManifestsCommand() {
  return createCommandDefinition({
    name: 'manifests',
    aliases: ['mf'],
    instruction: {
      usage: '/manifests',
      description: 'Show current team constraints',
      permission: 'player',
    },
    stateKeys: ['manifest'],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      const manifests = normalizeManifestList(state.manifest);

      if (manifests == null) {
        return { ok: false, code: 'INVALID_MANIFEST_STATE' };
      }

      return { ok: true, manifests };
    },
    action: async (context, state, condition) => ({
      changed: false,
      code: condition.manifests.length === 0 ? 'EMPTY_MANIFESTS' : 'READY',
      manifests: condition.manifests,
      showAliasNotice: context.command === 'mf',
    }),
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createTextResult(MANIFESTS_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_MANIFEST_STATE'
      ) {
        return createTextResult(MANIFESTS_MESSAGES.loadError);
      }

      return createManifestListResult(
        outcome.manifests,
        outcome.showAliasNotice
      );
    },
  });
}

module.exports = {
  MANIFESTS_MESSAGES,
  buildManifestLines,
  createManifestsCommand,
  normalizeManifestList,
};
