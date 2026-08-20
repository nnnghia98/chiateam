const {
  createBenchIdentityPolicy,
  createDefaultBenchIdentityPolicy,
} = require('../../core/ports/bench-identity-policy');

function parseTelegramUserId(externalId) {
  const userId = Number(externalId);

  return Number.isSafeInteger(userId) ? userId : externalId;
}

function createTelegramBenchIdentityPolicy() {
  const defaultPolicy = createDefaultBenchIdentityPolicy();

  return createBenchIdentityPolicy({
    createEntry(actor, name) {
      const userId = parseTelegramUserId(actor.externalId);

      return [userId, { name, userId }];
    },
    matchesEntry(entry, actor) {
      if (defaultPolicy.matchesEntry(entry, actor)) {
        return true;
      }

      if (!Array.isArray(entry) || entry.length < 2) {
        return false;
      }

      const [key, member] = entry;

      return (
        String(key) === actor.externalId ||
        (member != null &&
          typeof member === 'object' &&
          String(member.userId ?? '') === actor.externalId)
      );
    },
  });
}

module.exports = {
  createTelegramBenchIdentityPolicy,
  parseTelegramUserId,
};
