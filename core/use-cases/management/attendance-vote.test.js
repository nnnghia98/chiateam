const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ATTENDANCE_VOTE_OPTIONS,
  normalizeAttendanceVote,
  summarizeAttendanceVote,
} = require('./attendance-vote');

test('attendance vote normalizes legacy and platform-neutral choices', () => {
  const normalized = normalizeAttendanceVote({
    id: 'poll-1',
    question: 'Sân A 20h',
    options: ATTENDANCE_VOTE_OPTIONS,
    votes: {
      1: { id: 1, name: 'Alice', options: [2] },
      2: { id: 2, name: 'Bob', choice: '+4' },
      3: { id: 3, name: 'Carol', optionIndex: 1 },
    },
  });

  assert.deepEqual(
    normalized.voters.map(voter => ({
      name: voter.name,
      choice: voter.choice,
      partySize: voter.partySize,
    })),
    [
      { name: 'Alice', choice: '+2', partySize: 2 },
      { name: 'Bob', choice: '+4', partySize: 4 },
      { name: 'Carol', choice: '+1', partySize: 1 },
    ]
  );
});

test('attendance vote ignores retracted and malformed voter choices', () => {
  const normalized = normalizeAttendanceVote({
    question: 'Sân A 20h',
    options: ATTENDANCE_VOTE_OPTIONS,
    votes: {
      1: { id: 1, name: 'Alice', options: [] },
      2: { id: 2, name: 'Bob', choice: '+5' },
      3: null,
    },
  });

  assert.deepEqual(normalized.voters, []);
});

test('attendance vote summary counts voters and total people', () => {
  const summary = summarizeAttendanceVote({
    question: 'Sân A 20h',
    options: ATTENDANCE_VOTE_OPTIONS,
    votes: {
      1: { id: 1, name: 'Alice', options: [4] },
      2: { id: 2, name: 'Bob', choice: '+4' },
      3: { id: 3, name: 'Carol', options: [0] },
    },
  });

  assert.equal(summary.totalPeople, 8);
  assert.deepEqual(summary.choices[4], {
    label: '+4',
    choiceIndex: 4,
    count: 2,
    voterNames: ['Alice', 'Bob'],
  });
  assert.equal(summary.choices[0].count, 1);
});

test('attendance vote rejects invalid stored vote shapes', () => {
  assert.equal(normalizeAttendanceVote(null), null);
  assert.equal(
    normalizeAttendanceVote({
      question: '',
      options: ATTENDANCE_VOTE_OPTIONS,
      votes: {},
    }),
    null
  );
  assert.equal(
    normalizeAttendanceVote({
      question: 'Sân A',
      options: ['yes', 'no'],
      votes: {},
    }),
    null
  );
  assert.equal(
    normalizeAttendanceVote({
      question: 'Sân A',
      options: ATTENDANCE_VOTE_OPTIONS,
      votes: [],
    }),
    null
  );
});
