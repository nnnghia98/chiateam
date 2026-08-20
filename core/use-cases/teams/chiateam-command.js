const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { normalizeBenchEntries } = require('../bench/bench-member');
const {
  assignBenchEntries,
  buildManifestColorMap,
  getMemberIdentity,
  getMemberName,
} = require('./team-assignment');
const { normalizeManifestList } = require('./manifest-rules');

const CHIATEAM_STATE_KEYS = Object.freeze([
  'bench',
  'teamA',
  'teamB',
  'team3A',
  'team3B',
  'team3C',
  'manifest',
]);

const CHIATEAM_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /chiateam, /chiateam 2 hoặc /chiateam 3.',
  permissionDenied: '⛔ Chỉ admin mới có quyền.',
  allAssigned: '⚠️ Tất cả member đã có team rồi. Dùng /clearteam để reset.',
  notEnough: '❗ Không đủ người để chia 2 team.',
  notEnoughThree: '❗ Cần ít nhất 3 người để chia 3 team.',
  manifestConflict:
    '⚠️ Manifest hiện tại bị mâu thuẫn. Hãy sửa manifest trước khi chia team.',
  loadError: '❌ Không thể tải dữ liệu chia team từ API.',
  saveError: '❌ Không thể lưu team mới. Vui lòng thử lại.',
});

function getRequestedMode(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '2')) {
    return 2;
  }

  if (args.length === 1 && args[0] === '3') {
    return 3;
  }

  return null;
}

function getTargetTeamKeys(mode) {
  return mode === 3 ? ['team3A', 'team3B', 'team3C'] : ['teamA', 'teamB'];
}

function hasValidEntryList(value) {
  return normalizeBenchEntries(value) != null;
}

function getUnassignedEntries(bench, teamEntries) {
  const assignedIdentities = new Set(
    teamEntries.flatMap(entries =>
      entries.map(([, member]) => getMemberIdentity(member))
    )
  );

  return bench.filter(
    ([, member]) => !assignedIdentities.has(getMemberIdentity(member))
  );
}

function getTeamNames(entries) {
  return entries.map(([, member]) => getMemberName(member));
}

function buildTwoTeamSegments(home, away) {
  return [
    { text: '🎲 ' },
    { text: 'Chia team', bold: true },
    { text: ' 🎲\n\n⚪ ' },
    { text: `HOME (${home.length}):`, bold: true },
    { text: `\n${home.join('\n')}\n\n⚫ ` },
    { text: `AWAY (${away.length}):`, bold: true },
    { text: `\n${away.join('\n')}` },
  ];
}

function buildThreeTeamSegments(home, away, extra) {
  return [
    { text: '🎲 ' },
    { text: 'Chia 3 team', bold: true },
    { text: ' 🎲\n\n⚪ ' },
    { text: `HOME (${home.length}):`, bold: true },
    { text: `\n${home.join('\n')}\n\n⚫ ` },
    { text: `AWAY (${away.length}):`, bold: true },
    { text: `\n${away.join('\n')}\n\n🟠 ` },
    { text: `EXT (${extra.length}):`, bold: true },
    { text: `\n${extra.join('\n')}` },
  ];
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createAnnouncementResult = segments =>
  createRichTextResult(segments, [], { channel: 'announcement' });

function createChiateamCommand({ random = Math.random } = {}) {
  if (typeof random !== 'function') {
    throw new TypeError('random must be a function.');
  }

  return createCommandDefinition({
    name: 'chiateam',
    aliases: [],
    instruction: {
      usage: '/chiateam [2|3]',
      description: 'Assign unassigned bench members to balanced teams',
      permission: 'admin',
    },
    stateKeys: CHIATEAM_STATE_KEYS,
    condition: async (context, state) => {
      const mode = getRequestedMode(context.args);

      if (mode == null) {
        return { ok: false, code: 'INVALID_MODE' };
      }

      if (!hasValidEntryList(state.bench)) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
      }

      const teamKeys = getTargetTeamKeys(mode);

      if (teamKeys.some(key => !hasValidEntryList(state[key]))) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
      }

      const manifests = normalizeManifestList(state.manifest);

      if (manifests == null) {
        return { ok: false, code: 'INVALID_MANIFEST_STATE' };
      }

      if (buildManifestColorMap(manifests) == null) {
        return { ok: false, code: 'MANIFEST_CONFLICT' };
      }

      if (state.bench.length < mode) {
        return { ok: false, code: 'NOT_ENOUGH_MEMBERS', mode };
      }

      const teamEntries = teamKeys.map(key => state[key]);

      if (getUnassignedEntries(state.bench, teamEntries).length === 0) {
        return { ok: false, code: 'ALL_ASSIGNED', mode };
      }

      return { ok: true, mode, teamKeys, manifests };
    },
    action: async (context, state, condition) => {
      const teams = assignBenchEntries({
        bench: state.bench,
        teams: condition.teamKeys.map(key => ({ key, entries: state[key] })),
        manifests: condition.manifests,
        random,
      });
      const changes = Object.fromEntries(
        teams.map(team => [team.key, team.entries])
      );
      const names = teams.map(team => getTeamNames(team.entries));

      return {
        changed: true,
        code: 'TEAMS_ASSIGNED',
        changes,
        mode: condition.mode,
        teams: names,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(CHIATEAM_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_MODE') {
        return createDefaultResult(CHIATEAM_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_TEAM_STATE' ||
        outcome.code === 'INVALID_MANIFEST_STATE'
      ) {
        return createDefaultResult(CHIATEAM_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(CHIATEAM_MESSAGES.saveError);
      }

      if (outcome.code === 'MANIFEST_CONFLICT') {
        return createDefaultResult(CHIATEAM_MESSAGES.manifestConflict);
      }

      if (outcome.code === 'NOT_ENOUGH_MEMBERS') {
        return createDefaultResult(
          outcome.mode === 3
            ? CHIATEAM_MESSAGES.notEnoughThree
            : CHIATEAM_MESSAGES.notEnough
        );
      }

      if (outcome.code === 'ALL_ASSIGNED') {
        return createDefaultResult(CHIATEAM_MESSAGES.allAssigned);
      }

      return createAnnouncementResult(
        outcome.mode === 3
          ? buildThreeTeamSegments(
              outcome.teams[0],
              outcome.teams[1],
              outcome.teams[2]
            )
          : buildTwoTeamSegments(outcome.teams[0], outcome.teams[1])
      );
    },
  });
}

module.exports = {
  CHIATEAM_MESSAGES,
  CHIATEAM_STATE_KEYS,
  buildThreeTeamSegments,
  buildTwoTeamSegments,
  createChiateamCommand,
  getRequestedMode,
  getUnassignedEntries,
  normalizeManifestList,
};
