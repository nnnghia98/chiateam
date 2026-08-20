function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStateKeys(keys) {
  if (!Array.isArray(keys)) {
    throw new TypeError('state keys must be an array.');
  }

  return [...new Set(keys.map(value => String(value).trim()).filter(Boolean))];
}

function createStateRepository({ load, save } = {}) {
  if (typeof load !== 'function' || typeof save !== 'function') {
    throw new TypeError('state repository requires load and save functions.');
  }

  return Object.freeze({
    async load(keys) {
      const state = await load(normalizeStateKeys(keys));

      if (!isObject(state)) {
        throw new TypeError('state repository load must return an object.');
      }

      return state;
    },
    async save(changes) {
      if (!isObject(changes)) {
        throw new TypeError('state repository changes must be an object.');
      }

      return save(changes);
    },
  });
}

function assertStateRepository(repository) {
  if (
    !repository ||
    typeof repository.load !== 'function' ||
    typeof repository.save !== 'function'
  ) {
    throw new TypeError('A valid state repository is required.');
  }

  return repository;
}

module.exports = {
  assertStateRepository,
  createStateRepository,
};
