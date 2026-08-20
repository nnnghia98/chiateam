const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const { summarizeAttendanceVote } = require('./attendance-vote');

const DEMVOTE_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /demvote không kèm tham số.',
  noVote: '📭 Không có vote nào đang hoạt động để đếm.',
  loadError: '❌ Không thể tải kết quả vote hiện tại từ API.',
});

function buildVoteSummarySegments(summary) {
  const segments = [
    { text: '📊 Kết quả vote hiện tại:', bold: true },
    { text: '\n' },
    { text: summary.question, bold: true },
    { text: '\n\n' },
  ];

  summary.choices.forEach(choice => {
    segments.push(
      { text: choice.label, bold: true },
      { text: ` (${choice.count})\n` },
      { text: 'Ai vote?', bold: true },
      {
        text:
          choice.voterNames.length > 0
            ? ` ${choice.voterNames.join(', ')}\n\n`
            : ' Chưa có ai vote\n\n',
      }
    );
  });

  segments.push(
    { text: 'Số người vote:', bold: true },
    { text: ` ${summary.totalPeople}` }
  );

  return segments;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createDemvoteCommand() {
  return createCommandDefinition({
    name: 'demvote',
    aliases: [],
    instruction: {
      usage: '/demvote',
      description: 'Show the current attendance vote result',
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

      const summary = summarizeAttendanceVote(state.activeVote);

      return summary
        ? { ok: true, summary }
        : { ok: false, code: 'INVALID_VOTE_STATE' };
    },
    action: async (context, state, condition) => ({
      changed: false,
      code: 'VOTE_SUMMARY',
      summary: condition.summary,
    }),
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(DEMVOTE_MESSAGES.usage);
      }

      if (outcome.code === 'NO_ACTIVE_VOTE') {
        return createDefaultResult(DEMVOTE_MESSAGES.noVote);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_VOTE_STATE'
      ) {
        return createDefaultResult(DEMVOTE_MESSAGES.loadError);
      }

      return createRichTextResult(
        buildVoteSummarySegments(outcome.summary),
        [],
        {
          channel: 'main',
        }
      );
    },
  });
}

module.exports = {
  DEMVOTE_MESSAGES,
  buildVoteSummarySegments,
  createDemvoteCommand,
};
