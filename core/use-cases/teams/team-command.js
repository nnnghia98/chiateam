const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');

const TEAM_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /team, /team 2 hoặc /team 3.',
  loadError: '❌ Không thể tải danh sách đội hiện tại từ API.',
  noTwoTeam: '⚠️ Chưa có team nào được chia. Dùng /chiateam trước',
  noThreeTeam:
    '⚠️ Chưa có 3 team nào được chia. Dùng /chiateam 3 để chia 3 team',
});

const createTeamTextResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createTeamRichTextResult = segments =>
  createRichTextResult(segments, [], { channel: 'default' });

function getDisplayName(member) {
  if (typeof member === 'string') {
    return member;
  }

  return typeof member?.name === 'string' ? member.name : '';
}

function getTeamNames(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter(entry => Array.isArray(entry) && entry.length >= 2)
    .map(([, member]) => getDisplayName(member))
    .filter(Boolean);
}

function getRequestedMode(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '2')) {
    return 2;
  }

  if (args.length === 1 && args[0] === '3') {
    return 3;
  }

  return null;
}

function hasValidTeamState(state) {
  return ['teamA', 'teamB', 'team3A', 'team3B', 'team3C'].every(key =>
    Array.isArray(state[key])
  );
}

function buildTwoTeamMessage(home, away) {
  return (
    '🎲 Team hiện tại 🎲\n\n' +
    `⚪ HOME (${home.length}):\n${home.join('\n')}\n\n` +
    `⚫ AWAY (${away.length}):\n${away.join('\n')}`
  );
}

function buildThreeTeamMessage(home, away, extra) {
  return (
    '🎲 3 Team hiện tại 🎲\n\n' +
    `⚪ HOME (${home.length}):\n${home.join('\n') || '(trống)'}\n\n` +
    `⚫ AWAY (${away.length}):\n${away.join('\n') || '(trống)'}\n\n` +
    `🟠 EXT (${extra.length}):\n${extra.join('\n') || '(trống)'}`
  );
}

function buildTwoTeamSegments(home, away) {
  return [
    { text: '🎲 ' },
    { text: 'Team hiện tại', bold: true },
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
    { text: '3 Team hiện tại', bold: true },
    { text: ' 🎲\n\n⚪ ' },
    { text: `HOME (${home.length}):`, bold: true },
    { text: `\n${home.join('\n') || '(trống)'}\n\n⚫ ` },
    { text: `AWAY (${away.length}):`, bold: true },
    { text: `\n${away.join('\n') || '(trống)'}\n\n🟠 ` },
    { text: `EXT (${extra.length}):`, bold: true },
    { text: `\n${extra.join('\n') || '(trống)'}` },
  ];
}

function createTeamCommand() {
  return createCommandDefinition({
    name: 'team',
    aliases: [],
    instruction: {
      usage: '/team [2|3]',
      description: 'Show the current teams',
      permission: 'player',
    },
    stateKeys: ['teamA', 'teamB', 'team3A', 'team3B', 'team3C'],
    condition: async (context, state) => {
      const mode = getRequestedMode(context.args);

      if (mode == null) {
        return { ok: false, code: 'INVALID_MODE' };
      }

      if (!hasValidTeamState(state)) {
        return { ok: false, code: 'INVALID_TEAM_STATE' };
      }

      return { ok: true, mode };
    },
    action: async (context, state, condition) => {
      const teams =
        condition.mode === 3
          ? {
              home: getTeamNames(state.team3A),
              away: getTeamNames(state.team3B),
              extra: getTeamNames(state.team3C),
            }
          : {
              home: getTeamNames(state.teamA),
              away: getTeamNames(state.teamB),
              extra: [],
            };
      const isEmpty =
        teams.home.length === 0 &&
        teams.away.length === 0 &&
        teams.extra.length === 0;

      return {
        changed: false,
        code: isEmpty ? 'EMPTY_TEAMS' : 'TEAMS_READY',
        mode: condition.mode,
        teams,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_MODE') {
        return createTeamTextResult(TEAM_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_TEAM_STATE'
      ) {
        return createTeamTextResult(TEAM_MESSAGES.loadError);
      }

      if (outcome.code === 'EMPTY_TEAMS') {
        return createTeamTextResult(
          outcome.mode === 3
            ? TEAM_MESSAGES.noThreeTeam
            : TEAM_MESSAGES.noTwoTeam
        );
      }

      return createTeamRichTextResult(
        outcome.mode === 3
          ? buildThreeTeamSegments(
              outcome.teams.home,
              outcome.teams.away,
              outcome.teams.extra
            )
          : buildTwoTeamSegments(outcome.teams.home, outcome.teams.away)
      );
    },
  });
}

module.exports = {
  TEAM_MESSAGES,
  buildThreeTeamMessage,
  buildThreeTeamSegments,
  buildTwoTeamMessage,
  buildTwoTeamSegments,
  createTeamCommand,
  getRequestedMode,
  getTeamNames,
};
