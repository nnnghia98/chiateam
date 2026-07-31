const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTwoTeamFeeBreakdown,
  buildTwoTeamFeeMessage,
} = require('./two-team-fee');

function createTeams() {
  return {
    teamA: new Map([
      [1, { name: 'Alice' }],
      [2, { name: 'Bob' }],
    ]),
    teamB: new Map([[3, { name: 'Carol' }]]),
  };
}

test('2-team fee split adds water only to losing players', () => {
  const { teamA, teamB } = createTeams();
  const breakdown = getTwoTeamFeeBreakdown({
    tiensan: 500000,
    tiennuoc: 60000,
    teamThua: 'HOME',
    teamA,
    teamB,
  });

  assert.equal(breakdown.totalMembers, 3);
  assert.equal(breakdown.perMember, 166667);
  assert.equal(breakdown.waterPerLoser, 30000);
  assert.equal(breakdown.winnerTotal, 166667);
  assert.equal(breakdown.loserTotal, 196667);
});

test('2-team fee message lists winner and loser rosters', () => {
  const { teamA, teamB } = createTeams();
  const message = buildTwoTeamFeeMessage({
    tiensan: 500000,
    tiennuoc: 60000,
    teamThua: 'HOME',
    teamA,
    teamB,
  });

  assert.match(message, /AWAY \(thắng\)/);
  assert.match(message, /HOME \(thua\)/);
  assert.match(message, /Alice/);
  assert.match(message, /Carol/);
  assert.match(message, /196\.667 VND/);
});
