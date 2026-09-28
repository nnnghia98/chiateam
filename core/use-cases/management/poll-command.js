const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { normalizeAttendanceVote } = require('./attendance-vote');
const { VOTE_ACTIONS } = require('./vote-command');

const POLL_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /poll không kèm tham số.',
  noVote: '📭 Chưa có vote nào đang mở.',
  loadError: '❌ Không thể tải vote hiện tại từ API.',
});

function buildPollSegments(vote) {
  return [
    { text: '📊 VOTE ĐANG MỞ', bold: true },
    { text: '\n\n' },
    { text: vote.question, bold: true },
    { text: '\n\nDùng /vote để chọn bình chọn.' },
  ];
}

function buildPollActions() {
  return VOTE_ACTIONS;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createPollCommand() {
  return createCommandDefinition({
    name: 'poll',
    aliases: [],
    instruction: {
      usage: '/poll',
      description: 'Show the active vote and direct players to /vote',
      permission: 'player',
    },
    stateKeys: ['activeVote'],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      if (state.activeVote == null) {
        return { ok: false, code: 'NO_ACTIVE_VOTE' };
      }

      const vote = normalizeAttendanceVote(state.activeVote);

      return vote
        ? { ok: true, vote }
        : { ok: false, code: 'INVALID_VOTE_STATE' };
    },
    action: async (context, state, condition) => ({
      changed: false,
      code: 'POLL_SHOWN',
      vote: condition.vote,
    }),
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(POLL_MESSAGES.usage);
      }

      if (outcome.code === 'NO_ACTIVE_VOTE') {
        return createDefaultResult(POLL_MESSAGES.noVote);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_VOTE_STATE'
      ) {
        return createDefaultResult(POLL_MESSAGES.loadError);
      }

      return createRichTextResult(
        buildPollSegments(outcome.vote),
        buildPollActions(),
        { channel: 'announcement' }
      );
    },
  });
}

module.exports = {
  POLL_MESSAGES,
  buildPollActions,
  buildPollSegments,
  createPollCommand,
};
