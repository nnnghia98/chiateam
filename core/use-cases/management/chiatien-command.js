const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const {
  createRichTextResult,
  createTextResult,
} = require('../../contracts/command-result');
const {
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  formatMoney,
  normalizeFeeState,
} = require('./fee-view');
const { calculateTwoTeamFee } = require('./two-team-fee');

const CHIATIEN_MESSAGES = Object.freeze({
  usage: '⚠️ Dùng /chiatien không kèm tham số.',
  noFee: '💸 Bạn chưa thêm tiền sân. Dùng /tiensan [số tiền] trước.',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  threeTeamUnsupported:
    '⚠️ Chưa hỗ trợ chia tiền cho 3 team. Tính năng này sẽ được bổ sung sau.',
  loadError: '❌ Không thể tải dữ liệu chia tiền hiện tại từ API.',
});

const createDefaultResult = text =>
  createTextResult(text, [], { channel: 'default' });
const createAnnouncementResult = text =>
  createTextResult(text, [], { channel: 'announcement' });
const createRichAnnouncementResult = segments =>
  createRichTextResult(segments, [], { channel: 'announcement' });

function createChiatienCommand() {
  return createCommandDefinition({
    name: 'chiatien',
    aliases: [],
    instruction: {
      usage: '/chiatien',
      description: 'Calculate the current two-team fee split',
      permission: 'player',
    },
    stateKeys: [
      'tiensan',
      'tiennuoc',
      'teamThua',
      'teamA',
      'teamB',
      'team3A',
      'team3B',
      'team3C',
    ],
    condition: async (context, state) => {
      if (context.args.length > 0) {
        return { ok: false, code: 'INVALID_ARGUMENTS' };
      }

      const feeState = normalizeFeeState(state);

      return feeState
        ? { ok: true, feeState }
        : { ok: false, code: 'INVALID_FEE_STATE' };
    },
    action: async (context, state, condition) => {
      const feeState = condition.feeState;

      if (feeState.tiensan === 0) {
        return { changed: false, code: 'MISSING_VENUE_FEE' };
      }

      const totalMembers = feeState.teamA.length + feeState.teamB.length;

      if (totalMembers === 0) {
        const hasThreeTeams =
          feeState.team3A.length +
            feeState.team3B.length +
            feeState.team3C.length >
          0;

        return {
          changed: false,
          code: hasThreeTeams ? 'THREE_TEAM_UNSUPPORTED' : 'NO_MEMBERS',
        };
      }

      const breakdown = calculateTwoTeamFee({
        tiensan: feeState.tiensan,
        tiennuoc: feeState.tiennuoc,
        teamThua: feeState.teamThua,
        teamA: feeState.teamA,
        teamB: feeState.teamB,
      });

      if (breakdown) {
        return {
          changed: false,
          code: 'DETAILED_SPLIT',
          tiensan: feeState.tiensan,
          tiennuoc: feeState.tiennuoc,
          breakdown,
        };
      }

      return {
        changed: false,
        code: 'SIMPLE_SPLIT',
        tiensan: feeState.tiensan,
        totalMembers,
        perMember: Math.ceil(feeState.tiensan / totalMembers),
      };
    },
    reply: async outcome => {
      if (outcome.code === 'INVALID_ARGUMENTS') {
        return createDefaultResult(CHIATIEN_MESSAGES.usage);
      }

      if (
        outcome.code === 'STATE_LOAD_FAILED' ||
        outcome.code === 'INVALID_FEE_STATE'
      ) {
        return createDefaultResult(CHIATIEN_MESSAGES.loadError);
      }

      if (outcome.code === 'MISSING_VENUE_FEE') {
        return createDefaultResult(CHIATIEN_MESSAGES.noFee);
      }

      if (outcome.code === 'THREE_TEAM_UNSUPPORTED') {
        return createDefaultResult(CHIATIEN_MESSAGES.threeTeamUnsupported);
      }

      if (outcome.code === 'NO_MEMBERS') {
        return createDefaultResult(CHIATIEN_MESSAGES.noMembers);
      }

      if (outcome.code === 'DETAILED_SPLIT') {
        return createRichAnnouncementResult(
          buildDetailedSplitSegments(outcome)
        );
      }

      return createAnnouncementResult(buildSimpleSplitMessage(outcome));
    },
  });
}

module.exports = {
  CHIATIEN_MESSAGES,
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  createChiatienCommand,
  formatMoney,
  normalizeFeeState,
};
