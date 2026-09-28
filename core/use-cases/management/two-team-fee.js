const FEE_ROUNDING_STEP = 500;

function roundUpFee(amount) {
  return Math.ceil(amount / FEE_ROUNDING_STEP) * FEE_ROUNDING_STEP;
}

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
  const venueShare = tiensan / totalMembers;
  const perMember = roundUpFee(venueShare);
  const loserTotal = roundUpFee(
    venueShare + (loserCount > 0 ? tiennuoc / loserCount : 0)
  );
  const waterPerLoser = loserTotal - perMember;

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
    loserTotal,
  });
}

module.exports = {
  calculateTwoTeamFee,
  roundUpFee,
};
