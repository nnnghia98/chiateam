const { buildManifestColorMap } = require('./team-assignment');

function normalizeManifestList(value) {
  if (value == null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const manifests = values.map(manifest => {
    if (
      !manifest ||
      typeof manifest !== 'object' ||
      Array.isArray(manifest) ||
      !['same', 'different'].includes(manifest.relation) ||
      !Array.isArray(manifest.players) ||
      manifest.players.length !== 2
    ) {
      return null;
    }

    const players = manifest.players.map(player => {
      const identity = String(player?.identity ?? '').trim();

      if (!identity) {
        return null;
      }

      return {
        identity,
        name: String(player?.name ?? '').trim(),
      };
    });

    return players.some(player => player == null)
      ? null
      : { relation: manifest.relation, players };
  });

  return manifests.some(manifest => manifest == null) ? null : manifests;
}

function getManifestPairKey(manifest) {
  return manifest.players
    .map(player => player.identity)
    .sort()
    .join('|');
}

function upsertManifest(manifests, nextManifest) {
  const nextPairKey = getManifestPairKey(nextManifest);
  const existingIndex = manifests.findIndex(
    manifest => getManifestPairKey(manifest) === nextPairKey
  );
  const nextManifests =
    existingIndex === -1
      ? [...manifests, nextManifest]
      : manifests.map((manifest, index) =>
          index === existingIndex ? nextManifest : manifest
        );

  return {
    isReplacement: existingIndex !== -1,
    isValid: buildManifestColorMap(nextManifests) != null,
    manifests: nextManifests,
  };
}

module.exports = {
  getManifestPairKey,
  normalizeManifestList,
  upsertManifest,
};
