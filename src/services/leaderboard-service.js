const {
  findLeaderboardOrdered,
  applyMatchResultBatch,
  upsertTotals,
  getPlayerStats,
  getMultiplePlayerStats,
  updatePlayerGoal,
  updatePlayerAssist,
} = require('../api/leaderboard');

async function getLeaderboardForDisplay() {
  return findLeaderboardOrdered();
}

async function applyMatchResult({ result, playerNumbers }) {
  const upperResult = typeof result === 'string' ? result.toUpperCase() : result;
  const validResults = ['WIN', 'LOSE', 'DRAW'];

  if (!validResults.includes(upperResult)) {
    return {
      ok: false,
      code: 'INVALID_RESULT',
      data: { result },
    };
  }

  const normalizedIds = Array.isArray(playerNumbers)
    ? playerNumbers
        .map(n => Number(n))
        .filter(n => Number.isInteger(n) && n > 0)
    : [];

  if (normalizedIds.length === 0) {
    return {
      ok: false,
      code: 'NO_VALID_PLAYER_IDS',
      data: { playerNumbers },
    };
  }

  try {
    await applyMatchResultBatch(normalizedIds, upperResult);
    return {
      ok: true,
      result: upperResult,
      playerNumbers: normalizedIds,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'UNEXPECTED_ERROR',
      error,
    };
  }
}

async function updateGoalStat({ playerNumber, delta }) {
  const num = Number(delta);
  const playerNum = Number(playerNumber);

  if (!Number.isInteger(playerNum) || playerNum <= 0) {
    return {
      ok: false,
      code: 'INVALID_PLAYER_NUMBER',
      data: { playerNumber },
    };
  }

  if (!Number.isInteger(num)) {
    return {
      ok: false,
      code: 'INVALID_VALUE',
      data: { value: delta },
    };
  }

  try {
    await updatePlayerGoal(playerNum, num);
    return {
      ok: true,
      playerNumber: playerNum,
      value: num,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'UNEXPECTED_ERROR',
      error,
    };
  }
}

async function updateAssistStat({ playerNumber, delta }) {
  const num = Number(delta);
  const playerNum = Number(playerNumber);

  if (!Number.isInteger(playerNum) || playerNum <= 0) {
    return {
      ok: false,
      code: 'INVALID_PLAYER_NUMBER',
      data: { playerNumber },
    };
  }

  if (!Number.isInteger(num)) {
    return {
      ok: false,
      code: 'INVALID_VALUE',
      data: { value: delta },
    };
  }

  try {
    await updatePlayerAssist(playerNum, num);
    return {
      ok: true,
      playerNumber: playerNum,
      value: num,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'UNEXPECTED_ERROR',
      error,
    };
  }
}

module.exports = {
  getLeaderboardForDisplay,
  applyMatchResult,
  updateGoalStat,
  updateAssistStat,
  getPlayerStats,
  getMultiplePlayerStats,
  upsertTotals,
};

