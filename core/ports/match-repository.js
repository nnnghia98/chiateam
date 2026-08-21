const MATCH_REPOSITORY_METHODS = Object.freeze([
  'findByDate',
  'findWithPlayers',
  'save',
  'updateScore',
  'applyResult',
  'deleteByDate',
  'list',
  'containsPlayer',
  'addPlayerStat',
  'setMvp',
]);

function createMatchRepository(implementation = {}) {
  MATCH_REPOSITORY_METHODS.forEach(method => {
    if (typeof implementation[method] !== 'function') {
      throw new TypeError(`match repository ${method} must be a function.`);
    }
  });

  return Object.freeze(
    Object.fromEntries(
      MATCH_REPOSITORY_METHODS.map(method => [
        method,
        (...args) => implementation[method](...args),
      ])
    )
  );
}

function assertMatchRepository(repository) {
  if (
    !repository ||
    MATCH_REPOSITORY_METHODS.some(
      method => typeof repository[method] !== 'function'
    )
  ) {
    throw new TypeError('A valid match repository is required.');
  }

  return repository;
}

module.exports = {
  MATCH_REPOSITORY_METHODS,
  assertMatchRepository,
  createMatchRepository,
};
