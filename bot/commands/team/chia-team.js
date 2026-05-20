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

function assignManifestPair({ membersToAssign, teams, manifest }) {
  if (
    !manifest ||
    !Array.isArray(manifest.players) ||
    manifest.players.length !== 2
  ) {
    return membersToAssign;
  }

  const manifestIdentities = manifest.players.map(player => player.identity);
  const manifestMembers = manifestIdentities.map(identity =>
    membersToAssign.find(member => getMemberIdentity(member) === identity)
  );

  if (!manifestMembers.some(Boolean)) {
    return membersToAssign;
  }

  const existingIdentities = new Set(
    teams.flatMap(team => Array.from(team.map.values()).map(getMemberIdentity))
  );
  const assignedTeams = getAssignedTeamByIdentity(teams);
  const assignedManifestTeams = manifestIdentities.map((identity, index) =>
    manifestMembers[index] ? null : assignedTeams.get(identity)
  );

  if (manifest.relation === 'same') {
    const targetTeam =
      assignedManifestTeams.find(Boolean) || getRandomSmallestTeam(teams);

    manifestMembers.forEach((member, index) => {
      if (member && targetTeam) {
        addMemberToTeam(member, targetTeam, existingIdentities, index);
      }
    });
  } else {
    const firstAssignedTeam = manifestMembers[0]
      ? null
      : assignedTeams.get(manifestIdentities[0]);
    const secondAssignedTeam = manifestMembers[1]
      ? null
      : assignedTeams.get(manifestIdentities[1]);
    const firstTeam =
      firstAssignedTeam || getRandomSmallestTeam(teams, secondAssignedTeam);
    const secondTeam =
      secondAssignedTeam || getRandomSmallestTeam(teams, firstTeam);

    if (manifestMembers[0] && firstTeam) {
      addMemberToTeam(manifestMembers[0], firstTeam, existingIdentities, 0);
    }

    if (manifestMembers[1] && secondTeam) {
      addMemberToTeam(manifestMembers[1], secondTeam, existingIdentities, 1);
    }
  }

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

    const remainingMembers = assignManifestPair({
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

    const remainingMembers = assignManifestPair({
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
