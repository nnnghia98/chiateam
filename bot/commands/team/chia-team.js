const shuffleArray = require('../../utils/shuffle');
const { CHIA_TEAM } = require('../../utils/messages');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const { escapeMarkdown } = require('../../utils/format');

const bot = require('../../telegram-client');

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function getMemberIdentity(member) {
  if (member && typeof member === 'object') {
    if (member.userId != null) return `tele:${member.userId}`;
    if (member.memberId) return `member:${member.memberId}`;
    if (member.name) return `name:${normalizeName(member.name)}`;
  }

  return `name:${normalizeName(getDisplayName(member))}`;
}

function collectAssignedIdentities(teamMaps) {
  const assigned = new Set();
  teamMaps.forEach(map => {
    Array.from(map.values()).forEach(member => {
      assigned.add(getMemberIdentity(member));
    });
  });
  return assigned;
}

function getAssignedTeamByIdentity(teams) {
  const assigned = new Map();

  teams.forEach(team => {
    Array.from(team.map.values()).forEach(member => {
      assigned.set(getMemberIdentity(member), team);
    });
  });

  return assigned;
}

function addMemberToTeam(member, team, existingIdentities, keySalt) {
  const identity = getMemberIdentity(member);

  if (existingIdentities.has(identity)) {
    return false;
  }

  team.map.set(Date.now() + Math.random() + keySalt, member);
  existingIdentities.add(identity);
  return true;
}

function getRandomSmallestTeam(teams, excludedTeam = null) {
  const candidates = excludedTeam
    ? teams.filter(team => team !== excludedTeam)
    : teams;

  if (candidates.length === 0) {
    return null;
  }

  const minSize = Math.min(...candidates.map(team => team.map.size));
  const smallestTeams = candidates.filter(team => team.map.size === minSize);
  return smallestTeams[Math.floor(Math.random() * smallestTeams.length)];
}

function getManifestList(manifest) {
  if (!manifest) {
    return [];
  }

  return Array.isArray(manifest) ? manifest : [manifest];
}

function buildManifestColorMap(manifests) {
  const graph = new Map();
  const colors = new Map();

  manifests.forEach(currentManifest => {
    if (
      !currentManifest ||
      !Array.isArray(currentManifest.players) ||
      currentManifest.players.length !== 2
    ) {
      return;
    }

    const [first, second] = currentManifest.players.map(
      player => player.identity
    );
    const relationValue = currentManifest.relation === 'same' ? 0 : 1;

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
    if (currentParent === identity) return identity;
    const root = find(currentParent);
    parent.set(identity, root);
    return root;
  };

  const union = (first, second) => {
    parent.set(find(first), find(second));
  };

  manifests.forEach(currentManifest => {
    if (
      !currentManifest ||
      !Array.isArray(currentManifest.players) ||
      currentManifest.players.length !== 2
    ) {
      return;
    }

    const [first, second] = currentManifest.players.map(
      player => player.identity
    );
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

  return Array.from(components.values());
}

function assignManifestPairs({ membersToAssign, teams, manifest }) {
  const manifests = getManifestList(manifest);

  if (manifests.length === 0) {
    return membersToAssign;
  }

  const colorMap = buildManifestColorMap(manifests);
  if (!colorMap) {
    return membersToAssign;
  }

  const identityToMember = new Map(
    membersToAssign.map(member => [getMemberIdentity(member), member])
  );
  const existingIdentities = new Set(
    teams.flatMap(team => Array.from(team.map.values()).map(getMemberIdentity))
  );
  const assignedTeams = getAssignedTeamByIdentity(teams);

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
        colorTeams[0] = getRandomSmallestTeam(teams);
        colorTeams[1] = getRandomSmallestTeam(teams, colorTeams[0]);
      } else if (!colorTeams[0]) {
        colorTeams[0] = getRandomSmallestTeam(teams, colorTeams[1]);
      } else if (!colorTeams[1]) {
        colorTeams[1] = getRandomSmallestTeam(teams, colorTeams[0]);
      }
    } else {
      const [onlyColor] = presentColors;
      colorTeams[onlyColor] =
        colorTeams[onlyColor] || getRandomSmallestTeam(teams);
    }

    component.forEach(([identity, color]) => {
      const member = identityToMember.get(identity);
      const team = colorTeams[color];

      if (member && team) {
        addMemberToTeam(member, team, existingIdentities, color);
      }
    });
  });

  return membersToAssign.filter(
    member => !existingIdentities.has(getMemberIdentity(member))
  );
}

function assignMembersToSmallestTeams(membersToAssign, teams, commandLabel) {
  const existingIdentities = new Set(
    teams.flatMap(team => Array.from(team.map.values()).map(getMemberIdentity))
  );

  membersToAssign.forEach((entry, idx) => {
    const identity = getMemberIdentity(entry);
    if (existingIdentities.has(identity)) {
      console.warn(
        `[${commandLabel}] Skipped duplicate: ${getDisplayName(entry)} already assigned`
      );
      return;
    }

    const minSize = Math.min(...teams.map(team => team.map.size));
    const smallestTeams = teams.filter(team => team.map.size === minSize);
    const team =
      smallestTeams[Math.floor(Math.random() * smallestTeams.length)];

    team.map.set(Date.now() + Math.random() + idx, entry);
    existingIdentities.add(identity);
  });
}

const splitCommand = ({
  members,
  teamA,
  teamB,
  team3A,
  team3B,
  team3C,
  getManifest,
}) => {
  // Split into 2 teams (HOME / AWAY). Uses teamA/teamB. Bench is NOT cleared.
  bot.onText(/^\/chiateam$/, msg => {
    // Get members who are NOT already assigned in the 2-team stack.
    const assignedIdentities = collectAssignedIdentities([teamA, teamB]);

    const unassignedMembers = Array.from(members.values()).filter(
      member => !assignedIdentities.has(getMemberIdentity(member))
    );

    if (unassignedMembers.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CHIA_TEAM.allAssigned,
      });
      return;
    }

    if (members.size < 2) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CHIA_TEAM.notEnough,
      });
      return;
    }

    shuffleArray(unassignedMembers);

    const teams = [
      {
        map: teamA,
        name: 'HOME',
      },
      {
        map: teamB,
        name: 'AWAY',
      },
    ];

    const remainingMembers = assignManifestPairs({
      membersToAssign: unassignedMembers,
      teams,
      manifest: typeof getManifest === 'function' ? getManifest() : null,
    });

    assignMembersToSmallestTeams(remainingMembers, teams, 'chiateam');

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message: CHIA_TEAM.buildTwoTeamMessage(
        Array.from(teamA.values()).map(v => escapeMarkdown(getDisplayName(v))),
        Array.from(teamB.values()).map(v => escapeMarkdown(getDisplayName(v)))
      ),
      options: { parse_mode: 'Markdown' },
    });
  });

  // Split into 3 teams (HOME / AWAY / EXTRA). Uses team3A/team3B/team3C. Admin only. Bench is NOT cleared.
  bot.onText(/^\/chiateam 3$/, msg => {
    if (!requireAdmin(msg)) return;

    // Get members who are NOT already assigned in the 3-team stack.
    const assignedIdentities = collectAssignedIdentities([
      team3A,
      team3B,
      team3C,
    ]);

    const unassignedMembers = Array.from(members.values()).filter(
      member => !assignedIdentities.has(getMemberIdentity(member))
    );

    if (unassignedMembers.length === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CHIA_TEAM.allAssignedThree,
      });
      return;
    }

    if (members.size < 3) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CHIA_TEAM.notEnoughThree,
      });
      return;
    }

    shuffleArray(unassignedMembers);

    const teams = [
      {
        map: team3A,
        name: 'HOME',
      },
      {
        map: team3B,
        name: 'AWAY',
      },
      {
        map: team3C,
        name: 'EXTRA',
      },
    ];

    const remainingMembers = assignManifestPairs({
      membersToAssign: unassignedMembers,
      teams,
      manifest: typeof getManifest === 'function' ? getManifest() : null,
    });

    assignMembersToSmallestTeams(remainingMembers, teams, 'chiateam 3');

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message: CHIA_TEAM.buildThreeTeamMessage(
        Array.from(team3A.values()).map(v => escapeMarkdown(getDisplayName(v))),
        Array.from(team3B.values()).map(v => escapeMarkdown(getDisplayName(v))),
        Array.from(team3C.values()).map(v => escapeMarkdown(getDisplayName(v)))
      ),
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = splitCommand;
