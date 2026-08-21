const { getMemberName } = require('../teams/team-assignment');

function getMemberActor(member) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) {
    return null;
  }

  if (
    member.identity?.platform != null &&
    member.identity?.externalId != null
  ) {
    return {
      platform: String(member.identity.platform).toLowerCase(),
      externalId: String(member.identity.externalId),
      displayName: getMemberName(member),
      username: null,
    };
  }

  if (member.userId != null) {
    return {
      platform: 'telegram',
      externalId: String(member.userId),
      displayName: getMemberName(member),
      username: null,
    };
  }

  return null;
}

function findPlayerByName(displayName, allPlayers) {
  const baseName = String(displayName).split(' (')[0].trim().toLowerCase();

  return (
    allPlayers.find(
      player =>
        String(player?.name ?? '')
          .trim()
          .toLowerCase() === baseName
    ) || null
  );
}

function getTelegramUserId(actor, player) {
  const value =
    actor?.platform === 'telegram' ? actor.externalId : player?.user_id;
  const userId = Number(value);

  return Number.isSafeInteger(userId) && userId !== 0 ? userId : null;
}

async function resolveLineupMember(member, allPlayers, playerRepository) {
  const displayName = getMemberName(member).trim() || 'Không rõ';
  const actor = getMemberActor(member);
  const player = actor
    ? await playerRepository.findByActor(actor)
    : findPlayerByName(displayName, allPlayers);

  return {
    playerId: player?.id ?? null,
    userId: getTelegramUserId(actor, player),
    displayName,
  };
}

async function buildMatchLineups(state, playerRepository) {
  const teams = [state.teamA, state.teamB, state.team3C];

  if (
    teams.some(
      team =>
        !Array.isArray(team) ||
        team.some(entry => !Array.isArray(entry) || entry.length < 2)
    )
  ) {
    return null;
  }

  const allPlayers = await playerRepository.list();

  if (!Array.isArray(allPlayers)) {
    return null;
  }

  const resolveTeam = team =>
    Promise.all(
      team.map(([, member]) =>
        resolveLineupMember(member, allPlayers, playerRepository)
      )
    );
  const [homePlayers, awayPlayers, extraPlayers] = await Promise.all(
    teams.map(resolveTeam)
  );

  return { homePlayers, awayPlayers, extraPlayers };
}

module.exports = {
  buildMatchLineups,
  findPlayerByName,
  getMemberActor,
  getTelegramUserId,
  resolveLineupMember,
};
