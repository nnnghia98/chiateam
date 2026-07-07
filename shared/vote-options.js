function getSelectedVoteOption(voter) {
  return voter?.options?.[0];
}

function isComingVoteOption(voteOption) {
  return Number.isInteger(voteOption) && voteOption >= 1 && voteOption <= 4;
}

function isComingVote(voter) {
  return isComingVoteOption(getSelectedVoteOption(voter));
}

module.exports = {
  getSelectedVoteOption,
  isComingVote,
  isComingVoteOption,
};
