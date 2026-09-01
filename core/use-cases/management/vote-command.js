const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { getActorIdentityKey } = require('../../ports/bench-identity-policy');
const {
  ATTENDANCE_VOTE_OPTIONS,
  normalizeAttendanceVote,
} = require('./attendance-vote');

const VOTE_MESSAGES = Object.freeze({
  usage: '⚠️ Bình chọn bằng /vote 0, /vote 1, /vote 2, /vote 3 hoặc /vote 4.',
  noVote: '📭 Chưa có vote nào đang mở.',
  loadError: '❌ Không thể tải vote hiện tại từ API.',
  saveError: '❌ Không thể lưu lựa chọn. Vui lòng thử lại.',
});

function parseVoteChoice(args) {
  if (!Array.isArray(args) || args.length !== 1) {
    return null;
  }

  const value = String(args[0] ?? '').trim();
  let choice = null;

  if (value === '0') {
    choice = '0';
  } else if (/^\+?[1-4]$/.test(value)) {
    choice = `+${value.replace('+', '')}`;
  }

  const choiceIndex =
    choice == null ? -1 : ATTENDANCE_VOTE_OPTIONS.indexOf(choice);

  return choiceIndex >= 0 ? { choice, choiceIndex } : null;
}

function getActorName(actor) {
  return String(
    actor.displayName || actor.username || actor.externalId || ''
  ).trim();
}

function countComingVoters(activeVote) {
  const normalized = normalizeAttendanceVote(activeVote);

  return normalized
    ? normalized.voters.filter(voter => voter.partySize > 0).length
    : 0;
}

function buildVoteStatus(name, choice, unchanged = false) {
  const selection =
    choice === '0' ? 'không tham gia' : `tham gia ${choice.slice(1)} người`;

  return unchanged
    ? `ℹ️ ${name} vẫn chọn ${selection}.`
    : `✅ Đã ghi nhận ${name}: ${selection}.`;
}

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });

function createVoteCommand() {
  return createCommandDefinition({
    name: 'vote',
    aliases: [],
    instruction: {
      usage: '/vote 0|1|2|3|4',
      description: 'Cast or change the current actor attendance vote',
      permission: 'player',
    },
    stateKeys: ['activeVote'],
    condition: async (context, state) => {
      const request = parseVoteChoice(context.args);

      if (!request) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      if (state.activeVote == null) {
        return { ok: false, code: 'NO_ACTIVE_VOTE' };
      }

      const vote = normalizeAttendanceVote(state.activeVote);

      if (!vote) {
        return { ok: false, code: 'INVALID_VOTE_STATE' };
      }

      const name = getActorName(context.actor);
      const current = vote.voters.find(
        voter =>
          voter.platform === context.actor.platform &&
          voter.id === context.actor.externalId
      );

      return {
        ok: true,
        request,
        name,
        unchanged: current?.choice === request.choice,
      };
    },
    action: async (context, state, condition) => {
      if (condition.unchanged) {
        return {
          changed: false,
          code: 'VOTE_UNCHANGED',
          name: condition.name,
          choice: condition.request.choice,
        };
      }

      const voterKey = getActorIdentityKey(context.actor);
      const votes = {
        ...state.activeVote.votes,
        [voterKey]: {
          id: context.actor.externalId,
          platform: context.actor.platform,
          name: condition.name,
          choice: condition.request.choice,
          optionIndex: condition.request.choiceIndex,
          options: [condition.request.choiceIndex],
        },
      };
      const activeVote = {
        ...state.activeVote,
        votes,
      };

      activeVote.totalVoters = countComingVoters(activeVote);

      return {
        changed: true,
        code: 'VOTE_RECORDED',
        changes: { activeVote },
        name: condition.name,
        choice: condition.request.choice,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(VOTE_MESSAGES.usage);
      }

      if (outcome.code === 'NO_ACTIVE_VOTE') {
        return createDefaultResult(VOTE_MESSAGES.noVote);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_VOTE_STATE'
      ) {
        return createDefaultResult(VOTE_MESSAGES.loadError);
      }

      if (outcome.code === 'STATE_SAVE_FAILED') {
        return createDefaultResult(VOTE_MESSAGES.saveError);
      }

      return createTextResult(
        buildVoteStatus(
          outcome.name,
          outcome.choice,
          outcome.code === 'VOTE_UNCHANGED'
        ),
        [],
        { channel: 'source' }
      );
    },
  });
}

module.exports = {
  VOTE_MESSAGES,
  buildVoteStatus,
  countComingVoters,
  createVoteCommand,
  getActorName,
  parseVoteChoice,
};
