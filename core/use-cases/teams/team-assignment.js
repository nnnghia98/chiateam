function normalizeIdentityName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function getMemberName(member) {
  if (typeof member === 'string') {
    return member;
  }

  return typeof member?.name === 'string' ? member.name : '';
}

function getMemberIdentity(member) {
  if (member && typeof member === 'object') {
    if (member.userId != null) {
      return `tele:${member.userId}`;
    }

    if (member.memberId) {
      return `member:${member.memberId}`;
    }

    if (
      member.identity?.platform != null &&
      member.identity?.externalId != null
    ) {
      return `${member.identity.platform}:${member.identity.externalId}`;
    }
  }

  return `name:${normalizeIdentityName(getMemberName(member))}`;
}

function getEntryIdentity(entry) {
  return getMemberIdentity(entry[1]);
}

function getRandomIndex(length, random) {
  const value = Number(random());
  const normalized = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 0.9999999999999999)
    : 0;

  return Math.floor(normalized * length);
}

function shuffleEntries(entries, random) {
  const shuffled = [...entries];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = getRandomIndex(index + 1, random);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  return shuffled;
}

function getRandomSmallestTeam(teams, random, excludedTeam = null) {
  const candidates = excludedTeam
    ? teams.filter(team => team !== excludedTeam)
    : teams;

  if (candidates.length === 0) {
    return null;
  }

  const minimumSize = Math.min(...candidates.map(team => team.entries.length));
  const smallestTeams = candidates.filter(
    team => team.entries.length === minimumSize
  );

  return smallestTeams[getRandomIndex(smallestTeams.length, random)];
}

function createTeamEntryKey(team, identity) {
  const usedKeys = new Set(team.entries.map(([key]) => String(key)));
  const baseKey = `team:${identity}`;
  let key = baseKey;
  let suffix = 2;

  while (usedKeys.has(String(key))) {
    key = `${baseKey}:${suffix}`;
    suffix += 1;
  }

  return key;
}

function addEntryToTeam(entry, team, assignedIdentities, assignedTeams) {
  const identity = getEntryIdentity(entry);

  if (assignedIdentities.has(identity)) {
    return false;
  }

  team.entries.push([createTeamEntryKey(team, identity), entry[1]]);
  assignedIdentities.add(identity);
  assignedTeams.set(identity, team);
  return true;
}

function buildManifestColorMap(manifests) {
  const graph = new Map();
  const colors = new Map();

  manifests.forEach(manifest => {
    const [first, second] = manifest.players.map(player => player.identity);
    const relationValue = manifest.relation === 'same' ? 0 : 1;

    if (!graph.has(first)) graph.set(first, []);
    if (!graph.has(second)) graph.set(second, []);

    graph.get(first).push([second, relationValue]);
    graph.get(second).push([first, relationValue]);
  });

  for (const start of graph.keys()) {
    if (colors.has(start)) continue;

    colors.set(start, 0);
    const queue = [start];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentColor = colors.get(current);

      for (const [next, relationValue] of graph.get(current)) {
        const nextColor = currentColor ^ relationValue;

        if (!colors.has(next)) {
          colors.set(next, nextColor);
          queue.push(next);
        } else if (colors.get(next) !== nextColor) {
          return null;
        }
      }
    }
  }

  return colors;
}

function groupManifestComponents(colorMap, manifests) {
  const parent = new Map();

  const find = identity => {
    if (!parent.has(identity)) parent.set(identity, identity);

    const currentParent = parent.get(identity);

    if (currentParent === identity) {
      return identity;
    }

    const root = find(currentParent);
    parent.set(identity, root);
    return root;
  };

  const union = (first, second) => {
    parent.set(find(first), find(second));
  };

  manifests.forEach(manifest => {
    const [first, second] = manifest.players.map(player => player.identity);
    union(first, second);
  });

  const components = new Map();

  for (const [identity, color] of colorMap.entries()) {
    const root = find(identity);

    if (!components.has(root)) {
      components.set(root, []);
    }

    components.get(root).push([identity, color]);
  }

  return [...components.values()];
}

function createAssignedState(teams) {
  const identities = new Set();
  const teamsByIdentity = new Map();

  teams.forEach(team => {
    team.entries.forEach(entry => {
      const identity = getEntryIdentity(entry);
      identities.add(identity);
      teamsByIdentity.set(identity, team);
    });
  });

  return { identities, teamsByIdentity };
}

function assignManifestComponents({
  entries,
  teams,
  manifests,
  random,
  assignedIdentities,
  assignedTeams,
}) {
  if (manifests.length === 0) {
    return entries;
  }

  const colorMap = buildManifestColorMap(manifests);

  if (colorMap == null) {
    return entries;
  }

  const entriesByIdentity = new Map(
    entries.map(entry => [getEntryIdentity(entry), entry])
  );

  groupManifestComponents(colorMap, manifests).forEach(component => {
    const colorTeams = [null, null];
    const presentColors = new Set(component.map(([, color]) => color));

    component.forEach(([identity, color]) => {
      const assignedTeam = assignedTeams.get(identity);

      if (assignedTeam && !colorTeams[color]) {
        colorTeams[color] = assignedTeam;
      }
    });

    if (presentColors.size > 1) {
      if (colorTeams[0] && colorTeams[1] && colorTeams[0] === colorTeams[1]) {
        return;
      }

      if (!colorTeams[0] && !colorTeams[1]) {
        colorTeams[0] = getRandomSmallestTeam(teams, random);
        colorTeams[1] = getRandomSmallestTeam(teams, random, colorTeams[0]);
      } else if (!colorTeams[0]) {
        colorTeams[0] = getRandomSmallestTeam(teams, random, colorTeams[1]);
      } else if (!colorTeams[1]) {
        colorTeams[1] = getRandomSmallestTeam(teams, random, colorTeams[0]);
      }
    } else {
      const [onlyColor] = presentColors;
      colorTeams[onlyColor] =
        colorTeams[onlyColor] || getRandomSmallestTeam(teams, random);
    }

    component.forEach(([identity, color]) => {
      const entry = entriesByIdentity.get(identity);
      const team = colorTeams[color];

      if (entry && team) {
        addEntryToTeam(entry, team, assignedIdentities, assignedTeams);
      }
    });
  });

  return entries.filter(
    entry => !assignedIdentities.has(getEntryIdentity(entry))
  );
}

function assignBenchEntries({ bench, teams, manifests = [], random }) {
  if (!Array.isArray(bench) || !Array.isArray(teams) || teams.length < 2) {
    throw new TypeError('Team assignment requires a bench and target teams.');
  }

  if (!Array.isArray(manifests) || typeof random !== 'function') {
    throw new TypeError('Team assignment requires manifests and randomness.');
  }

  const nextTeams = teams.map(team => ({
    ...team,
    entries: team.entries.map(([key, member]) => [key, member]),
  }));
  const { identities, teamsByIdentity } = createAssignedState(nextTeams);
  const unassigned = shuffleEntries(
    bench.filter(entry => !identities.has(getEntryIdentity(entry))),
    random
  );
  const remaining = assignManifestComponents({
    entries: unassigned,
    teams: nextTeams,
    manifests,
    random,
    assignedIdentities: identities,
    assignedTeams: teamsByIdentity,
  });

  remaining.forEach(entry => {
    const team = getRandomSmallestTeam(nextTeams, random);
    addEntryToTeam(entry, team, identities, teamsByIdentity);
  });

  return nextTeams;
}

module.exports = {
  assignBenchEntries,
  buildManifestColorMap,
  createTeamEntryKey,
  getMemberIdentity,
  getMemberName,
  getRandomSmallestTeam,
  groupManifestComponents,
  shuffleEntries,
};
