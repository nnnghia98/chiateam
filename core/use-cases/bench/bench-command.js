const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');

const BENCH_MESSAGES = Object.freeze({
  empty: '⚠️ Bench trống.',
  success: '👥 Danh sách hiện tại:\n{names}\n\nTổng: {count} player(s)',
  loadError: '❌ Không thể tải bench hiện tại từ API.',
});

const createBenchResult = text =>
  createTextResult(text, [], { channel: 'default' });

function getDisplayName(member) {
  if (typeof member === 'string') {
    return member;
  }

  return typeof member?.name === 'string' ? member.name : '';
}

function getBenchNames(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter(entry => Array.isArray(entry) && entry.length >= 2)
    .map(([, member]) => getDisplayName(member))
    .filter(Boolean);
}

function createBenchCommand() {
  return createCommandDefinition({
    name: 'bench',
    aliases: [],
    instruction: {
      usage: '/bench',
      description: 'Show the current bench',
      permission: 'player',
    },
    stateKeys: ['bench'],
    condition: async (context, state) => ({
      ok: Array.isArray(state.bench),
      code: Array.isArray(state.bench) ? null : 'INVALID_BENCH_STATE',
    }),
    action: async (context, state) => {
      const names = getBenchNames(state.bench);

      return {
        changed: false,
        code: names.length === 0 ? 'EMPTY_BENCH' : 'BENCH_READY',
        names,
      };
    },
    reply: async outcome => {
      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_BENCH_STATE'
      ) {
        return createBenchResult(BENCH_MESSAGES.loadError);
      }

      if (outcome.code === 'EMPTY_BENCH') {
        return createBenchResult(BENCH_MESSAGES.empty);
      }

      const names = outcome.names.map((name, index) => `${index + 1}. ${name}`);

      return createBenchResult(
        BENCH_MESSAGES.success
          .replace('{count}', names.length)
          .replace('{names}', names.join('\n'))
      );
    },
  });
}

module.exports = {
  BENCH_MESSAGES,
  createBenchCommand,
  getBenchNames,
};
