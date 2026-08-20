const {
  getMultiplePlayerStats,
  getPlayerStats,
  updateAssistStat,
  updateGoalStat,
  upsertTotals,
} = require('../../api/services/leaderboard-service');
const {
  createStatisticsRepository,
} = require('../../core/ports/statistics-repository');

function createApiStatisticsRepository({
  getOne = getPlayerStats,
  getMany = getMultiplePlayerStats,
  replace = upsertTotals,
  addGoals = updateGoalStat,
  addAssists = updateAssistStat,
} = {}) {
  return createStatisticsRepository({
    findByNumber(number) {
      return getOne(number);
    },
    findMany(numbers) {
      return getMany(numbers);
    },
    replaceTotals(number, totals) {
      return replace(
        number,
        totals.matches,
        totals.wins,
        totals.losses,
        totals.draws
      );
    },
    incrementGoals(number, count) {
      return addGoals({ playerNumber: number, delta: count });
    },
    incrementAssists(number, count) {
      return addAssists({ playerNumber: number, delta: count });
    },
  });
}

module.exports = {
  createApiStatisticsRepository,
};
