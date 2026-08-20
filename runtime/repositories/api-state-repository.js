const {
  readBotStorage,
  writeBotStorage,
} = require('../../bot/utils/api-client');
const { createStateRepository } = require('../../core/ports/state-repository');

function pickState(state, keys) {
  if (keys.includes('*')) {
    return { ...state };
  }

  return keys.reduce((selected, key) => {
    selected[key] = state[key];
    return selected;
  }, {});
}

function createApiStateRepository({
  read = readBotStorage,
  write = writeBotStorage,
  afterSave,
} = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') {
    throw new TypeError(
      'API state repository requires read and write functions.'
    );
  }

  if (afterSave != null && typeof afterSave !== 'function') {
    throw new TypeError('API state repository afterSave must be a function.');
  }

  return createStateRepository({
    async load(keys) {
      const state = await read();

      if (!state || typeof state !== 'object' || Array.isArray(state)) {
        throw new TypeError('Bot storage API returned invalid state.');
      }

      return pickState(state, keys);
    },
    async save(changes) {
      const currentState = await read();

      if (
        !currentState ||
        typeof currentState !== 'object' ||
        Array.isArray(currentState)
      ) {
        throw new TypeError('Bot storage API returned invalid state.');
      }

      const saved = await write({ ...currentState, ...changes });

      if (afterSave) {
        await afterSave(saved);
      }

      return saved;
    },
  });
}

module.exports = {
  createApiStateRepository,
};
