const TEAM_TARGETS = Object.freeze({
  '2:HOME': Object.freeze({ key: 'teamA', label: 'Home' }),
  '2:AWAY': Object.freeze({ key: 'teamB', label: 'Away' }),
  '3:HOME': Object.freeze({ key: 'team3A', label: 'Home' }),
  '3:AWAY': Object.freeze({ key: 'team3B', label: 'Away' }),
  '3:EXTRA': Object.freeze({ key: 'team3C', label: 'Extra' }),
});

const TEAM_STACK_KEYS = Object.freeze({
  2: Object.freeze(['teamA', 'teamB']),
  3: Object.freeze(['team3A', 'team3B', 'team3C']),
});

function getTeamTarget(mode, teamType) {
  return TEAM_TARGETS[`${mode}:${teamType}`] || null;
}

function getTeamStackKeys(mode) {
  return TEAM_STACK_KEYS[mode] || null;
}

module.exports = {
  TEAM_STACK_KEYS,
  TEAM_TARGETS,
  getTeamStackKeys,
  getTeamTarget,
};
