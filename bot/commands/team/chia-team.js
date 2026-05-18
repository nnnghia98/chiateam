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

const splitCommand = ({ members, teamA, teamB, team3A, team3B, team3C }) => {
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

    // Smart distribution: balance teams based on current sizes
    const currentSizes = [teamA.size, teamB.size];
    const totalMembers =
      currentSizes[0] + currentSizes[1] + unassignedMembers.length;
    const idealPerTeam = Math.floor(totalMembers / 2);
    const remainder = totalMembers % 2;

    // Calculate how many members each team needs
    const teams = [
      {
        current: currentSizes[0],
        target: idealPerTeam,
        map: teamA,
        name: 'HOME',
      },
      {
        current: currentSizes[1],
        target: idealPerTeam,
        map: teamB,
        name: 'AWAY',
      },
    ];

    // Sort teams by current size (smallest first)
    teams.sort((a, b) => a.current - b.current);

    // Give the extra member to a random team
    if (remainder > 0) {
      teams[Math.random() < 0.5 ? 0 : 1].target++;
    }

    // Calculate needed members for each team
    teams.forEach(team => {
      team.needed = Math.max(0, team.target - team.current);
    });

    // Distribute unassigned members to teams based on need
    let memberIndex = 0;
    teams.forEach(team => {
      const membersToAdd = unassignedMembers.slice(
        memberIndex,
        memberIndex + team.needed
      );

      // Get existing member identities in this team to check for duplicates.
      const existingInTeam = new Set(
        Array.from(team.map.values()).map(getMemberIdentity)
      );

      membersToAdd.forEach((entry, idx) => {
        // Only add if not already in this team
        const identity = getMemberIdentity(entry);
        if (!existingInTeam.has(identity)) {
          team.map.set(Date.now() + Math.random() + memberIndex + idx, entry);
          existingInTeam.add(identity);
        } else {
          console.warn(
            `[chiateam] Skipped duplicate: ${getDisplayName(entry)} already in ${team.name}`
          );
        }
      });
      memberIndex += team.needed;
    });

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

    // Smart distribution: balance teams based on current sizes
    const currentSizes = [team3A.size, team3B.size, team3C.size];
    const totalMembers =
      currentSizes[0] +
      currentSizes[1] +
      currentSizes[2] +
      unassignedMembers.length;
    const idealPerTeam = Math.floor(totalMembers / 3);
    const remainder = totalMembers % 3;

    // Calculate how many members each team needs
    const teams = [
      {
        index: 0,
        current: currentSizes[0],
        target: idealPerTeam,
        map: team3A,
        name: 'HOME',
      },
      {
        index: 1,
        current: currentSizes[1],
        target: idealPerTeam,
        map: team3B,
        name: 'AWAY',
      },
      {
        index: 2,
        current: currentSizes[2],
        target: idealPerTeam,
        map: team3C,
        name: 'EXTRA',
      },
    ];

    // Sort teams by current size (smallest first) to prioritize filling smaller teams
    teams.sort((a, b) => a.current - b.current);

    // Distribute remainder randomly
    const remainderIndices = [0, 1, 2];
    for (let i = remainderIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainderIndices[i], remainderIndices[j]] = [
        remainderIndices[j],
        remainderIndices[i],
      ];
    }
    for (let i = 0; i < remainder; i++) {
      teams[remainderIndices[i]].target++;
    }

    // Calculate needed members for each team
    teams.forEach(team => {
      team.needed = Math.max(0, team.target - team.current);
    });

    // Distribute unassigned members to teams based on need
    let memberIndex = 0;
    teams.forEach(team => {
      const membersToAdd = unassignedMembers.slice(
        memberIndex,
        memberIndex + team.needed
      );

      // Get existing member identities in this team to check for duplicates.
      const existingInTeam = new Set(
        Array.from(team.map.values()).map(getMemberIdentity)
      );

      membersToAdd.forEach((entry, idx) => {
        // Only add if not already in this team
        const identity = getMemberIdentity(entry);
        if (!existingInTeam.has(identity)) {
          team.map.set(Date.now() + Math.random() + memberIndex + idx, entry);
          existingInTeam.add(identity);
        } else {
          console.warn(
            `[chiateam 3] Skipped duplicate: ${getDisplayName(entry)} already in ${team.name}`
          );
        }
      });
      memberIndex += team.needed;
    });

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
