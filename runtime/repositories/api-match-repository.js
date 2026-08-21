const {
  addMatchPlayerStatDelta,
  applyMatchOutcome,
  createOrUpdateMatch,
  deleteMatchByDate,
  getMatchByDate,
  getMatchWithPlayers,
  isPlayerInMatch,
  listMatches,
  setMatchMvp,
  updateMatchResult,
} = require('../../api/routes/matches');
const { createMatchRepository } = require('../../core/ports/match-repository');

function createApiMatchRepository({
  getByDate = getMatchByDate,
  getWithPlayers = getMatchWithPlayers,
  saveMatch = createOrUpdateMatch,
  setScore = updateMatchResult,
  setResult = applyMatchOutcome,
  removeByDate = deleteMatchByDate,
  getList = listMatches,
  hasPlayer = isPlayerInMatch,
  addStat = addMatchPlayerStatDelta,
  setPlayerMvp = setMatchMvp,
} = {}) {
  return createMatchRepository({
    findByDate(date) {
      return getByDate(date);
    },
    findWithPlayers(date) {
      return getWithPlayers(date);
    },
    save(draft) {
      return saveMatch(draft);
    },
    updateScore(date, homeScore, awayScore) {
      return setScore(date, homeScore, awayScore);
    },
    applyResult(date, winnerSide) {
      return setResult(date, winnerSide);
    },
    deleteByDate(date) {
      return removeByDate(date);
    },
    list(limit, offset) {
      return getList(limit, offset);
    },
    containsPlayer(matchId, playerId) {
      return hasPlayer(matchId, playerId);
    },
    addPlayerStat(matchId, playerId, stat, count) {
      return addStat(matchId, playerId, stat, count);
    },
    setMvp(matchId, playerId) {
      return setPlayerMvp(matchId, playerId);
    },
  });
}

module.exports = {
  createApiMatchRepository,
};
