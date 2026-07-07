const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getSelectedVoteOption,
  isComingVote,
  isComingVoteOption,
} = require('./vote-options');

test('coming votes are only explicit +1 through +4 options', () => {
  assert.equal(isComingVoteOption(1), true);
  assert.equal(isComingVoteOption(2), true);
  assert.equal(isComingVoteOption(3), true);
  assert.equal(isComingVoteOption(4), true);

  assert.equal(isComingVoteOption(0), false);
  assert.equal(isComingVoteOption(undefined), false);
  assert.equal(isComingVoteOption(null), false);
  assert.equal(isComingVoteOption(5), false);
  assert.equal(isComingVoteOption('1'), false);
});

test('retracted and zero votes are not syncable coming votes', () => {
  assert.equal(isComingVote({ options: [1] }), true);
  assert.equal(isComingVote({ options: [4] }), true);
  assert.equal(isComingVote({ options: [0] }), false);
  assert.equal(isComingVote({ options: [] }), false);
  assert.equal(isComingVote({}), false);
  assert.equal(isComingVote(null), false);
});

test('selected vote option reads the first Telegram poll option id', () => {
  assert.equal(getSelectedVoteOption({ options: [3] }), 3);
  assert.equal(getSelectedVoteOption({ options: [] }), undefined);
  assert.equal(getSelectedVoteOption({}), undefined);
});
