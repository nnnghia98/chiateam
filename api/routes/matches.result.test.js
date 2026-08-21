const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMatchOutcomePlan } = require('./matches');

test('match outcome plan creates winner and loser changes for registered players', () => {
  const plan = buildMatchOutcomePlan(
    [],
    [
      { player_id: 1, number: 10, side: 'HOME' },
      { player_id: 2, number: 11, side: 'AWAY' },
      { player_id: null, number: null, side: 'HOME' },
      { player_id: 3, number: 12, side: 'EXTRA' },
    ],
    'HOME'
  );

  assert.deepEqual(plan.desiredResults, [
    {
      playerId: 1,
      playerNumber: 10,
      side: 'HOME',
      result: 'WIN',
    },
    {
      playerId: 2,
      playerNumber: 11,
      side: 'AWAY',
      result: 'LOSE',
    },
  ]);
  assert.deepEqual(plan.changes, [
    {
      playerId: 1,
      previousPlayerNumber: null,
      nextPlayerNumber: 10,
      previousResult: null,
      nextResult: 'WIN',
    },
    {
      playerId: 2,
      previousPlayerNumber: null,
      nextPlayerNumber: 11,
      previousResult: null,
      nextResult: 'LOSE',
    },
  ]);
  assert.equal(plan.winners, 1);
  assert.equal(plan.losers, 1);
  assert.equal(plan.unchanged, false);
});

test('match outcome plan is unchanged for the same saved result', () => {
  const plan = buildMatchOutcomePlan(
    [
      { player_id: 1, number: 10, result: 'WIN' },
      { player_id: 2, number: 11, result: 'LOSE' },
    ],
    [
      { player_id: 1, number: 10, side: 'HOME' },
      { player_id: 2, number: 11, side: 'AWAY' },
    ],
    'HOME'
  );

  assert.deepEqual(plan.changes, []);
  assert.equal(plan.unchanged, true);
});

test('match outcome plan reverses old totals when the winning side changes', () => {
  const plan = buildMatchOutcomePlan(
    [
      { player_id: 1, number: 10, result: 'WIN' },
      { player_id: 2, number: 11, result: 'LOSE' },
    ],
    [
      { player_id: 1, number: 10, side: 'HOME' },
      { player_id: 2, number: 11, side: 'AWAY' },
    ],
    'AWAY'
  );

  assert.deepEqual(plan.changes, [
    {
      playerId: 1,
      previousPlayerNumber: 10,
      nextPlayerNumber: 10,
      previousResult: 'WIN',
      nextResult: 'LOSE',
    },
    {
      playerId: 2,
      previousPlayerNumber: 11,
      nextPlayerNumber: 11,
      previousResult: 'LOSE',
      nextResult: 'WIN',
    },
  ]);
  assert.equal(plan.winners, 1);
  assert.equal(plan.losers, 1);
});

test('match outcome plan removes an old result after a registered player leaves', () => {
  const plan = buildMatchOutcomePlan(
    [{ player_id: 1, number: 10, result: 'WIN' }],
    [],
    'HOME'
  );

  assert.deepEqual(plan.changes, [
    {
      playerId: 1,
      previousPlayerNumber: 10,
      nextPlayerNumber: null,
      previousResult: 'WIN',
      nextResult: null,
    },
  ]);
  assert.deepEqual(plan.desiredResults, []);
});

test('match outcome plan rejects one registered player on both sides', () => {
  assert.throws(
    () =>
      buildMatchOutcomePlan(
        [],
        [
          { player_id: 1, number: 10, side: 'HOME' },
          { player_id: 1, number: 10, side: 'AWAY' },
        ],
        'HOME'
      ),
    /both match sides/
  );
});
