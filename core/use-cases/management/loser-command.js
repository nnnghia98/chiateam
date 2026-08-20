const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { getWinnerFromLoser } = require('./winner-command');

const LOSER_MESSAGES = Object.freeze({
  read: '⚠️ /loser sẽ được bỏ. Hãy dùng /winner để xem team thắng.',
  usage: '⚠️ /loser sẽ được bỏ. Dùng /winner HOME hoặc /winner AWAY thay thế.',
  replacement: '⚠️ /loser sẽ được bỏ. Lệnh thay thế: /winner {team}',
});

function parseLoserRequest(args) {
  if (!Array.isArray(args)) {
    return null;
  }

  if (args.length === 0) {
    return { kind: 'read', replacement: '/winner' };
  }

  if (args.length !== 1) {
    return null;
  }

  const loser = String(args[0]).trim().toUpperCase();

  if (!['HOME', 'AWAY'].includes(loser)) {
    return null;
  }

  return {
    kind: 'write',
    loser,
    winner: getWinnerFromLoser(loser),
  };
}

function createLoserCommand() {
  return createCommandDefinition({
    name: 'loser',
    aliases: [],
    instruction: {
      usage: '/loser [HOME|AWAY]',
      description: 'Show the replacement for the deprecated loser command',
      permission: 'player',
    },
    stateKeys: [],
    condition: async context => {
      const request = parseLoserRequest(context.args);

      return request
        ? { ok: true, request }
        : { ok: false, code: 'INVALID_ARGUMENTS' };
    },
    action: async (context, state, condition) => ({
      changed: false,
      code:
        condition.request.kind === 'read'
          ? 'LOSER_DEPRECATED_READ'
          : 'LOSER_DEPRECATED_WRITE',
      request: condition.request,
    }),
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createTextResult(LOSER_MESSAGES.usage, [], {
          channel: 'default',
        });
      }

      const text =
        outcome.code === 'LOSER_DEPRECATED_READ'
          ? LOSER_MESSAGES.read
          : LOSER_MESSAGES.replacement.replace(
              '{team}',
              outcome.request.winner
            );

      return createTextResult(text, [], { channel: 'default' });
    },
  });
}

module.exports = {
  LOSER_MESSAGES,
  createLoserCommand,
  parseLoserRequest,
};
