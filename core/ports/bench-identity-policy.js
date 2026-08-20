function createBenchIdentityPolicy({ createEntry, matchesEntry } = {}) {
  if (typeof createEntry !== 'function' || typeof matchesEntry !== 'function') {
    throw new TypeError(
      'bench identity policy requires createEntry and matchesEntry functions.'
    );
  }

  return Object.freeze({
    createEntry(actor, name) {
      const entry = createEntry(actor, name);

      if (!Array.isArray(entry) || entry.length < 2) {
        throw new TypeError('bench identity policy must create a map entry.');
      }

      return entry;
    },
    matchesEntry(entry, actor) {
      return Boolean(matchesEntry(entry, actor));
    },
  });
}

function getActorIdentityKey(actor) {
  return `${actor.platform}:${actor.externalId}`;
}

function createDefaultBenchIdentityPolicy() {
  return createBenchIdentityPolicy({
    createEntry(actor, name) {
      const identityKey = getActorIdentityKey(actor);

      return [
        identityKey,
        {
          name,
          memberId: identityKey,
          identity: {
            platform: actor.platform,
            externalId: actor.externalId,
          },
        },
      ];
    },
    matchesEntry(entry, actor) {
      if (!Array.isArray(entry) || entry.length < 2) {
        return false;
      }

      const [key, member] = entry;
      const identityKey = getActorIdentityKey(actor);

      if (String(key) === identityKey) {
        return true;
      }

      if (!member || typeof member !== 'object') {
        return false;
      }

      return (
        String(member.memberId || '') === identityKey ||
        (member.identity?.platform === actor.platform &&
          String(member.identity.externalId) === actor.externalId)
      );
    },
  });
}

function assertBenchIdentityPolicy(policy) {
  if (
    !policy ||
    typeof policy.createEntry !== 'function' ||
    typeof policy.matchesEntry !== 'function'
  ) {
    throw new TypeError('A valid bench identity policy is required.');
  }

  return policy;
}

module.exports = {
  assertBenchIdentityPolicy,
  createBenchIdentityPolicy,
  createDefaultBenchIdentityPolicy,
  getActorIdentityKey,
};
