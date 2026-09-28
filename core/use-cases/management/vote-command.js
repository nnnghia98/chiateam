const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const { getActorIdentityKey } = require('../../ports/bench-identity-policy');
const {
  ATTENDANCE_VOTE_LABELS,
  ATTENDANCE_VOTE_OPTIONS,
  normalizeAttendanceVote,
} = require('./attendance-vote');

const VOTE_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /vote để chọn ⚽️ Đá hoặc 🫷 Thôi.',
  prompt: 'Chọn một câu trả lời cho vote này:',
  permissionDenied: '⛔ Bạn không có quyền thực hiện lệnh này.',
  noVote: '📭 Chưa có vote nào đang mở.',
  loadError: '❌ Không thể tải vote hiện tại từ API.',
  saveError: '❌ Không thể lưu lựa chọn. Vui lòng thử lại.',
});

const VOTE_ACTIONS = Object.freeze([
  Object.freeze({
    id: 'vote_yes',
    label: ATTENDANCE_VOTE_LABELS['1'],
    command: '/vote 1',
  }),
  Object.freeze({
    id: 'vote_no',
    label: ATTENDANCE_VOTE_LABELS['0'],
    command: '/vote 0',
  }),
]);

function parseVoteChoice(args) {
  if (!Array.isArray(args) || args.length !== 1) {
    return null;
  }

  const choice = String(args[0] ?? '').trim();
  const choiceIndex = ATTENDANCE_VOTE_OPTIONS.indexOf(choice);

  return choiceIndex >= 0
    ? { choice, choiceIndex, partySize: choiceIndex }
    : null;
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

function getVoteIdentityKey(actor) {
  if (actor.platform === 'telegram' && /^\d+$/.test(String(actor.externalId))) {
    return String(actor.externalId);
  }

  return getActorIdentityKey(actor);
}

function buildVoteStatus(name, choice, unchanged = false) {
  const selection = ATTENDANCE_VOTE_LABELS[choice] || choice;

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
      usage: '/vote',
      description: 'Show vote choices or cast/change an attendance vote',
      permission: 'player',
    },
    stateKeys: ['activeVote'],
    condition: async (context, state) => {
      const isPrompt = context.args.length === 0;
      const request = isPrompt ? null : parseVoteChoice(context.args);

      if (!isPrompt && !request) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      if (state.activeVote == null) {
        return { ok: false, code: 'NO_ACTIVE_VOTE' };
      }

      const vote = normalizeAttendanceVote(state.activeVote);

      if (!vote) {
        return { ok: false, code: 'INVALID_VOTE_STATE' };
      }

      if (isPrompt) {
        return { ok: true, isPrompt, vote };
      }

      const name = getActorName(context.actor);
      const current = vote.voters.find(
        voter =>
          voter.platform === context.actor.platform &&
          voter.id === context.actor.externalId
      );

      return {
        ok: true,
        isPrompt,
        request,
        name,
        unchanged:
          current?.choice === request.choice &&
          current?.partySize === request.partySize,
      };
    },
    action: async (context, state, condition) => {
      if (condition.isPrompt) {
        return {
          changed: false,
          code: 'VOTE_PROMPTED',
          vote: condition.vote,
        };
      }

      if (condition.unchanged) {
        return {
          changed: false,
          code: 'VOTE_UNCHANGED',
          name: condition.name,
          choice: condition.request.choice,
          partySize: condition.request.partySize,
        };
      }

      const voterKey = getVoteIdentityKey(context.actor);
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
        partySize: condition.request.partySize,
      };
    },
    reply: async outcome => {
      if (outcome.code === 'PERMISSION_DENIED') {
        return createDefaultResult(VOTE_MESSAGES.permissionDenied);
      }

      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(VOTE_MESSAGES.usage);
      }

      if (outcome.code === 'VOTE_PROMPTED') {
        return createTextResult(
          `${outcome.vote.question}\n\n${VOTE_MESSAGES.prompt}`,
          VOTE_ACTIONS,
          { channel: 'source' }
        );
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
  VOTE_ACTIONS,
  buildVoteStatus,
  countComingVoters,
  createVoteCommand,
  getActorName,
  getVoteIdentityKey,
  parseVoteChoice,
};
