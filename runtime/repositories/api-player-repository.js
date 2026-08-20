const {
  getAllPlayers,
  getPlayerByNumber,
  getPlayerByUserId,
} = require('../../api/routes/players');
const {
  deletePlayerByNumber,
  registerPlayer,
  registerPlayerForAnother,
} = require('../../api/services/player-service');
const {
  createPlayerRepository,
} = require('../../core/ports/player-repository');

function getTelegramUserId(actor) {
  if (actor?.platform !== 'telegram') {
    return null;
  }

  const userId = Number(actor.externalId);

  return Number.isSafeInteger(userId) ? userId : null;
}

function createApiPlayerRepository({
  registerSelf = registerPlayer,
  registerOther = registerPlayerForAnother,
  removeByNumber = deletePlayerByNumber,
  getByUserId = getPlayerByUserId,
  getByNumber = getPlayerByNumber,
  getAll = getAllPlayers,
} = {}) {
  return createPlayerRepository({
    async registerActor(actor, number) {
      const userId = getTelegramUserId(actor);

      if (userId == null) {
        return { ok: false, code: 'UNSUPPORTED_PLATFORM' };
      }

      return registerSelf({
        teleUser: {
          id: userId,
          first_name: actor.displayName,
          username: actor.username,
        },
        number,
      });
    },
    registerGuest(name, number) {
      return registerOther({ name, number });
    },
    deleteByNumber(number) {
      return removeByNumber(number);
    },
    findByActor(actor) {
      const userId = getTelegramUserId(actor);

      return userId == null ? null : getByUserId(userId);
    },
    findByNumber(number) {
      return getByNumber(number);
    },
    list() {
      return getAll();
    },
  });
}

module.exports = {
  createApiPlayerRepository,
  getTelegramUserId,
};
