const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateTwoTeamFee } = require('./two-team-fee');

test('shared fee rule adds water only to losing players', () => {
  const result = calculateTwoTeamFee({
    tiensan: 500000,
    tiennuoc: 60000,
    teamThua: 'HOME',
    teamA: ['Alice', 'Bob'],
    teamB: ['Carol'],
  });

  assert.equal(result.totalMembers, 3);
  assert.equal(result.perMember, 167000);
  assert.equal(result.waterPerLoser, 30000);
  assert.equal(result.winnerTotal, 167000);
  assert.equal(result.loserTotal, 197000);
  assert.deepEqual(result.winnerMembers, ['Carol']);
  assert.deepEqual(result.loserMembers, ['Alice', 'Bob']);
});

test('shared fee rule returns null without a valid losing team or members', () => {
  assert.equal(
    calculateTwoTeamFee({
      tiensan: 500000,
      tiennuoc: 60000,
      teamThua: null,
      teamA: ['Alice'],
      teamB: ['Bob'],
    }),
    null
  );
  assert.equal(
    calculateTwoTeamFee({
      tiensan: 500000,
      tiennuoc: 60000,
      teamThua: 'HOME',
      teamA: [],
      teamB: [],
    }),
    null
  );
});
