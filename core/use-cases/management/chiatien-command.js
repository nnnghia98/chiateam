const {
  createCommandDefinition,
} = require('../../contracts/command-definition');
const { createTextResult } = require('../../contracts/command-result');
const {
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  formatMoney,
  normalizeFeeState,
} = require('./fee-view');
const { calculateTwoTeamFee, roundUpFee } = require('./two-team-fee');

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
function createDetailedFeeRows(breakdown) {
  return [
    ...breakdown.winnerMembers.map(name => ({
      name,
      team: breakdown.winnerName,
      amount: breakdown.winnerTotal,
    })),
    ...breakdown.loserMembers.map(name => ({
      name,
      team: breakdown.loserName,
      amount: breakdown.loserTotal,
    })),
  ];
}

function createSimpleFeeRows(feeState, amount) {
  return [
    ...feeState.teamA.map(name => ({ name, team: 'HOME', amount })),
    ...feeState.teamB.map(name => ({ name, team: 'AWAY', amount })),
  ];
}

function normalizePlayerName(name) {
  return String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTeamFeeRows(rows, team) {
  const members = rows.filter(row => row.team === team);
  return [
    `${team === 'HOME' ? '⚪' : '⚫'} ${team} (${members.length} người):`,
    ...members.map(
      row =>
        `• ${normalizePlayerName(row.name)}: ${formatMoney(row.amount)} VND`
    ),
  ].join('\n');
}

function buildFeePreview(outcome) {
  const { breakdown, feeRows, tiensan, tiennuoc } = outcome;
  const totalMembers = breakdown?.totalMembers ?? outcome.totalMembers;
  const lines = [
    '💸 Xem trước chia tiền',
    `Tiền sân: ${formatMoney(tiensan)} VND`,
    `Tiền nước: ${formatMoney(tiennuoc)} VND${breakdown ? '' : ' (chưa tính vào phí)'}`,
    `Số người: ${totalMembers}`,
    '',
  ];
  lines.push(
    formatTeamFeeRows(feeRows, 'HOME'),
    '',
    formatTeamFeeRows(feeRows, 'AWAY')
  );
  return lines.join('\n');
}

function createChiatienCommand() {
  return createCommandDefinition({
    name: 'chiatien',
    aliases: [],
    instruction: {
      usage: '/chiatien',
      description: 'Preview each player’s fee without sending payment requests',
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
          feeRows: createDetailedFeeRows(breakdown),
        };
      }

      const perMember = roundUpFee(feeState.tiensan / totalMembers);
      return {
        changed: false,
        code: 'SIMPLE_SPLIT',
        tiensan: feeState.tiensan,
        tiennuoc: feeState.tiennuoc,
        totalMembers,
        perMember,
        feeRows: createSimpleFeeRows(feeState, perMember),
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
        return createAnnouncementResult(buildFeePreview(outcome));
      }

      if (outcome.code === 'SIMPLE_SPLIT') {
        return createAnnouncementResult(buildFeePreview(outcome));
      }

      return createAnnouncementResult(buildSimpleSplitMessage(outcome));
    },
  });
}

module.exports = {
  CHIATIEN_MESSAGES,
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  createDetailedFeeRows,
  createSimpleFeeRows,
  createChiatienCommand,
  formatMoney,
  normalizeFeeState,
};
