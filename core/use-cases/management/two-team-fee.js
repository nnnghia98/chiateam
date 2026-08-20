function calculateTwoTeamFee({ tiensan, tiennuoc, teamThua, teamA, teamB }) {
  if (!['HOME', 'AWAY'].includes(teamThua)) {
    return null;
  }

  if (!Array.isArray(teamA) || !Array.isArray(teamB)) {
    throw new TypeError('Two-team fee calculation requires team arrays.');
  }

  const totalMembers = teamA.length + teamB.length;

  if (totalMembers === 0) {
    return null;
  }

  const loserMembers = teamThua === 'HOME' ? teamA : teamB;
  const winnerMembers = teamThua === 'HOME' ? teamB : teamA;
  const loserName = teamThua;
  const winnerName = teamThua === 'HOME' ? 'AWAY' : 'HOME';
  const loserCount = loserMembers.length;
  const perMember = Math.ceil(tiensan / totalMembers);
  const waterPerLoser = loserCount > 0 ? Math.ceil(tiennuoc / loserCount) : 0;

  return Object.freeze({
    totalMembers,
    loserMembers,
    winnerMembers,
    loserName,
    winnerName,
    loserCount,
    perMember,
    waterPerLoser,
    winnerTotal: perMember,
    loserTotal: perMember + waterPerLoser,
  });
}

module.exports = {
  calculateTwoTeamFee,
};
