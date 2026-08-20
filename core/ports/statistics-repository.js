const STATISTICS_REPOSITORY_METHODS = Object.freeze([
  'findByNumber',
  'findMany',
  'replaceTotals',
  'incrementGoals',
  'incrementAssists',
]);

function createStatisticsRepository(implementation = {}) {
  STATISTICS_REPOSITORY_METHODS.forEach(method => {
    if (typeof implementation[method] !== 'function') {
      throw new TypeError(
        `statistics repository ${method} must be a function.`
      );
    }
  });

  return Object.freeze(
    Object.fromEntries(
      STATISTICS_REPOSITORY_METHODS.map(method => [
        method,
        (...args) => implementation[method](...args),
      ])
    )
  );
}

function assertStatisticsRepository(repository) {
  if (
    !repository ||
    STATISTICS_REPOSITORY_METHODS.some(
      method => typeof repository[method] !== 'function'
    )
  ) {
    throw new TypeError('A valid statistics repository is required.');
  }

  return repository;
}

module.exports = {
  STATISTICS_REPOSITORY_METHODS,
  assertStatisticsRepository,
  createStatisticsRepository,
};
