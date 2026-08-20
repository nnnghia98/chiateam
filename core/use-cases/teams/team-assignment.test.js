const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assignBenchEntries,
  buildManifestColorMap,
  getMemberIdentity,
} = require('./team-assignment');

function createBench(count) {
  return Array.from({ length: count }, (_, index) => [
    index + 1,
    { name: `Player ${index + 1}`, userId: index + 1 },
  ]);
}

function findTeam(teams, identity) {
  return teams.find(team =>
    team.entries.some(([, member]) => getMemberIdentity(member) === identity)
  )?.key;
}

test('shared assignment balances members without mutating input state', () => {
  const bench = createBench(5);
  const teams = [
    { key: 'teamA', entries: [] },
    { key: 'teamB', entries: [] },
  ];
  const originalBench = structuredClone(bench);
  const originalTeams = structuredClone(teams);

  const assigned = assignBenchEntries({
    bench,
    teams,
    random: () => 0,
  });

  assert.equal(assigned[0].entries.length + assigned[1].entries.length, 5);
  assert.ok(
    Math.abs(assigned[0].entries.length - assigned[1].entries.length) <= 1
  );
  assert.match(String(assigned[0].entries[0][0]), /^team:tele:/);
  assert.deepEqual(bench, originalBench);
  assert.deepEqual(teams, originalTeams);
});

test('shared assignment fills smaller teams and skips assigned identities', () => {
  const bench = createBench(4);
  const assigned = assignBenchEntries({
    bench,
    teams: [
      { key: 'teamA', entries: [bench[0], bench[1]] },
      { key: 'teamB', entries: [] },
    ],
    random: () => 0,
  });

  assert.equal(assigned[0].entries.length, 2);
  assert.equal(assigned[1].entries.length, 2);
  assert.equal(
    new Set(
      assigned.flatMap(team =>
        team.entries.map(([, member]) => getMemberIdentity(member))
      )
    ).size,
    4
  );
});

test('shared assignment applies same and different manifest relations', () => {
  const bench = createBench(4);
  const assigned = assignBenchEntries({
    bench,
    teams: [
      { key: 'teamA', entries: [] },
      { key: 'teamB', entries: [] },
    ],
    manifests: [
      {
        relation: 'same',
        players: [{ identity: 'tele:1' }, { identity: 'tele:2' }],
      },
      {
        relation: 'different',
        players: [{ identity: 'tele:3' }, { identity: 'tele:4' }],
      },
    ],
    random: () => 0,
  });

  assert.equal(findTeam(assigned, 'tele:1'), findTeam(assigned, 'tele:2'));
  assert.notEqual(findTeam(assigned, 'tele:3'), findTeam(assigned, 'tele:4'));
});

test('shared assignment applies connected manifests as one component', () => {
  const bench = createBench(4);
  const assigned = assignBenchEntries({
    bench,
    teams: [
      { key: 'teamA', entries: [] },
      { key: 'teamB', entries: [] },
    ],
    manifests: [
      {
        relation: 'different',
        players: [{ identity: 'tele:1' }, { identity: 'tele:2' }],
      },
      {
        relation: 'same',
        players: [{ identity: 'tele:2' }, { identity: 'tele:3' }],
      },
      {
        relation: 'different',
        players: [{ identity: 'tele:3' }, { identity: 'tele:4' }],
      },
    ],
    random: () => 0,
  });

  assert.notEqual(findTeam(assigned, 'tele:1'), findTeam(assigned, 'tele:2'));
  assert.equal(findTeam(assigned, 'tele:2'), findTeam(assigned, 'tele:3'));
  assert.notEqual(findTeam(assigned, 'tele:3'), findTeam(assigned, 'tele:4'));
});

test('shared three-team assignment uses random choice for equal smallest teams', () => {
  const bench = createBench(4);
  const assigned = assignBenchEntries({
    bench,
    teams: [
      { key: 'team3A', entries: [bench[0]] },
      { key: 'team3B', entries: [bench[1]] },
      { key: 'team3C', entries: [bench[2]] },
    ],
    random: () => 0.99,
  });

  assert.equal(assigned[0].entries.length, 1);
  assert.equal(assigned[1].entries.length, 1);
  assert.equal(assigned[2].entries.length, 2);
});

test('manifest coloring reports contradictory constraints', () => {
  const colors = buildManifestColorMap([
    {
      relation: 'same',
      players: [{ identity: 'tele:1' }, { identity: 'tele:2' }],
    },
    {
      relation: 'different',
      players: [{ identity: 'tele:1' }, { identity: 'tele:2' }],
    },
  ]);

  assert.equal(colors, null);
});
