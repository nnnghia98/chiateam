const PLAYER_REPOSITORY_METHODS = Object.freeze([
  'registerActor',
  'registerGuest',
  'deleteByNumber',
  'findByActor',
  'findByNumber',
  'list',
]);

function createPlayerRepository(implementation = {}) {
  PLAYER_REPOSITORY_METHODS.forEach(method => {
    if (typeof implementation[method] !== 'function') {
      throw new TypeError(`player repository ${method} must be a function.`);
    }
  });

  return Object.freeze(
    Object.fromEntries(
      PLAYER_REPOSITORY_METHODS.map(method => [
        method,
        (...args) => implementation[method](...args),
      ])
    )
  );
}

function assertPlayerRepository(repository) {
  if (
    !repository ||
    PLAYER_REPOSITORY_METHODS.some(
      method => typeof repository[method] !== 'function'
    )
  ) {
    throw new TypeError('A valid player repository is required.');
  }

  return repository;
}

module.exports = {
  PLAYER_REPOSITORY_METHODS,
  assertPlayerRepository,
  createPlayerRepository,
};
