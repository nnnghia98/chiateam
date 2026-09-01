const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { normalizeAttendanceVote } = require('./attendance-vote');

const POLL_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /poll không kèm tham số.',
  noVote: '📭 Chưa có vote nào đang mở.',
  loadError: '❌ Không thể tải vote hiện tại từ API.',
});

const VOTE_ACTION_LABELS = Object.freeze([
  'Không tham gia',
  'Đi 1 người',
  'Đi 2 người',
  'Đi 3 người',
  'Đi 4 người',
]);

function buildPollSegments(vote) {
  return [
    { text: '📊 VOTE ĐANG MỞ', bold: true },
    { text: '\n\n' },
    { text: vote.question, bold: true },
    { text: '\n\nChọn số người tham gia bên dưới.' },
    { text: '\nBạn có thể vote lại để đổi lựa chọn.' },
  ];
}

function buildPollActions(vote) {
  return vote.options.map((option, index) => ({
    id: `vote_${index}`,
    label: `${VOTE_ACTION_LABELS[index]} (${option})`,
    command: `/vote ${option}`,
  }));
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createPollCommand() {
  return createCommandDefinition({
    name: 'poll',
    aliases: [],
    instruction: {
      usage: '/poll',
      description: 'Show the active attendance vote as text actions',
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
        buildPollActions(outcome.vote),
        { channel: 'announcement' }
      );
    },
  });
}

module.exports = {
  POLL_MESSAGES,
  VOTE_ACTION_LABELS,
  buildPollActions,
  buildPollSegments,
  createPollCommand,
};
