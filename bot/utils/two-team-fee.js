const { escapeMarkdown, formatMoney } = require('./format');
const { getDisplayName } = require('./team-member');
const {
  calculateTwoTeamFee,
} = require('../../core/use-cases/management/two-team-fee');

function getTwoTeamFeeBreakdown({ tiensan, tiennuoc, teamThua, teamA, teamB }) {
  const breakdown = calculateTwoTeamFee({
    tiensan,
    tiennuoc,
    teamThua,
    teamA: Array.from(teamA.values()),
    teamB: Array.from(teamB.values()),
  });

  if (!breakdown) {
    return null;
  }

  const loserTeam = teamThua === 'HOME' ? teamA : teamB;
  const winnerTeam = teamThua === 'HOME' ? teamB : teamA;

  return {
    ...breakdown,
    loserTeam,
    winnerTeam,
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
