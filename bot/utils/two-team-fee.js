const { escapeMarkdown, formatMoney } = require('./format');
const { getDisplayName } = require('./team-member');

function getTwoTeamFeeBreakdown({ tiensan, tiennuoc, teamThua, teamA, teamB }) {
  if (!['HOME', 'AWAY'].includes(teamThua)) {
    return null;
  }

  const totalMembers = teamA.size + teamB.size;
  if (totalMembers === 0) {
    return null;
  }

  const loserTeam = teamThua === 'HOME' ? teamA : teamB;
  const winnerTeam = teamThua === 'HOME' ? teamB : teamA;
  const loserName = teamThua;
  const winnerName = teamThua === 'HOME' ? 'AWAY' : 'HOME';
  const loserCount = loserTeam.size;
  const perMember = Math.ceil(tiensan / totalMembers);
  const waterPerLoser = loserCount > 0 ? Math.ceil(tiennuoc / loserCount) : 0;

  return {
    totalMembers,
    loserTeam,
    winnerTeam,
    loserName,
    winnerName,
    loserCount,
    perMember,
    waterPerLoser,
    winnerTotal: perMember,
    loserTotal: perMember + waterPerLoser,
  };
}

function buildTwoTeamFeeMessage({ tiensan, tiennuoc, teamThua, teamA, teamB }) {
  const breakdown = getTwoTeamFeeBreakdown({
    tiensan,
    tiennuoc,
    teamThua,
    teamA,
    teamB,
  });

  if (!breakdown) {
    return null;
  }

  const loserMembers = Array.from(breakdown.loserTeam.values())
    .map(value => escapeMarkdown(getDisplayName(value)))
    .join('\n');
  const winnerMembers = Array.from(breakdown.winnerTeam.values())
    .map(value => escapeMarkdown(getDisplayName(value)))
    .join('\n');

  return (
    `💸 *Tiền sân: ${formatMoney(tiensan)} VND*\n` +
    `👥 Tổng số người: ${breakdown.totalMembers}\n` +
    `🧊 *Tiền nước: ${formatMoney(tiennuoc)} VND*\n\n` +
    `*${breakdown.winnerName} (thắng):*\n${winnerMembers}\n\n` +
    `*${breakdown.loserName} (thua):*\n${loserMembers}\n\n` +
    `Mỗi người đội thắng: ${formatMoney(breakdown.winnerTotal)} VND\n` +
    `Mỗi người đội thua: ${formatMoney(breakdown.perMember)} + ` +
    `${formatMoney(breakdown.waterPerLoser)} = ` +
    `*${formatMoney(breakdown.loserTotal)} VND*`
  );
}

module.exports = {
  buildTwoTeamFeeMessage,
  getTwoTeamFeeBreakdown,
};
