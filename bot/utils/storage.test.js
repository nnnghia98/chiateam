const test = require('node:test');
const assert = require('node:assert/strict');

const { createStateFromData } = require('./storage');

test('saved API snapshot updates legacy maps without replacing references', () => {
  const state = createStateFromData({
    bench: [[1, { name: 'Old player' }]],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    san: 'Sân cũ',
  });
  const benchReference = state.bench;

  state.syncFromSnapshot({
    bench: [[2, { name: 'New player', userId: 2 }]],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    manifest: null,
    san: 'Sân số 8',
    tiensan: 0,
    tiennuoc: 0,
    teamThua: null,
    activeVote: null,
    lastUpdated: '2026-08-04T10:00:00.000+07:00',
  });

  assert.equal(state.bench, benchReference);
  assert.deepEqual(Array.from(state.bench.entries()), [
    [2, { name: 'New player', userId: 2 }],
  ]);
  assert.equal(state.getSan(), 'Sân số 8');
  assert.equal(state.getLastUpdated(), '2026-08-04T10:00:00.000+07:00');
});

test('legacy storage snapshots without a venue stay compatible', () => {
  const state = createStateFromData({
    bench: [],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
  });

  assert.equal(state.getSan(), null);
});
