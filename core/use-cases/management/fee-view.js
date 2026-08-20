const { formatMoney } = require('./money');

function getDisplayName(member) {
  if (typeof member === 'string') {
    return member;
  }

  return typeof member?.name === 'string' ? member.name : '';
}

function getMemberNames(entries) {
  return entries
    .filter(entry => Array.isArray(entry) && entry.length >= 2)
    .map(([, member]) => getDisplayName(member))
    .filter(Boolean);
}

function parseStoredMoney(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function normalizeFeeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return null;
  }

  const teamKeys = ['teamA', 'teamB', 'team3A', 'team3B', 'team3C'];

  if (!teamKeys.every(key => Array.isArray(state[key]))) {
    return null;
  }

  const tiensan = parseStoredMoney(state.tiensan);
  const tiennuoc = parseStoredMoney(state.tiennuoc);

  if (tiensan == null || tiennuoc == null) {
    return null;
  }

  return {
    tiensan,
    tiennuoc,
    teamThua: ['HOME', 'AWAY'].includes(state.teamThua) ? state.teamThua : null,
    teamA: getMemberNames(state.teamA),
    teamB: getMemberNames(state.teamB),
    team3A: getMemberNames(state.team3A),
    team3B: getMemberNames(state.team3B),
    team3C: getMemberNames(state.team3C),
  };
}

function buildSimpleSplitMessage({ tiensan, totalMembers, perMember }) {
  return (
    `💸 Tổng tiền: ${formatMoney(tiensan)} VND\n` +
    `👥 Số người: ${totalMembers}\n\n` +
    `Mỗi người phải trả: ${formatMoney(perMember)} VND`
  );
}

function buildDetailedSplitSegments({ tiensan, tiennuoc, breakdown }) {
  return [
    { text: '💸 ' },
    { text: `Tiền sân: ${formatMoney(tiensan)} VND`, bold: true },
    { text: '\n🧊 ' },
    { text: `Tiền nước: ${formatMoney(tiennuoc)} VND`, bold: true },
    { text: `\n👥 Tổng số người: ${breakdown.totalMembers}\n\n` },
    { text: `${breakdown.winnerName} (thắng):`, bold: true },
    { text: `\n${breakdown.winnerMembers.join('\n')}\n\n` },
    { text: `${breakdown.loserName} (thua):`, bold: true },
    { text: `\n${breakdown.loserMembers.join('\n')}\n\n` },
    {
      text: `Mỗi người đội thắng: ${formatMoney(breakdown.winnerTotal)} VND\n`,
    },
    {
      text:
        `Mỗi người đội thua: ${formatMoney(breakdown.perMember)} + ` +
        `${formatMoney(breakdown.waterPerLoser)} = `,
    },
    { text: `${formatMoney(breakdown.loserTotal)} VND`, bold: true },
  ];
}

module.exports = {
  buildDetailedSplitSegments,
  buildSimpleSplitMessage,
  formatMoney,
  normalizeFeeState,
};
