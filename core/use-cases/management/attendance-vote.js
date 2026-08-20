const ATTENDANCE_VOTE_OPTIONS = Object.freeze(['0', '+1', '+2', '+3', '+4']);

function getChoiceIndex(vote, options) {
  if (!vote || typeof vote !== 'object' || Array.isArray(vote)) {
    return null;
  }

  const namedChoice = vote.choice ?? vote.option;

  if (typeof namedChoice === 'string') {
    const index = options.indexOf(namedChoice.trim());
    return index >= 0 ? index : null;
  }

  const legacyChoice = vote.optionIndex ?? vote.options?.[0];

  return Number.isInteger(legacyChoice) && legacyChoice >= 0
    ? legacyChoice
    : null;
}

function normalizeVoter(vote, key, options) {
  if (!vote || typeof vote !== 'object' || Array.isArray(vote)) {
    return null;
  }

  const name = String(vote.name ?? '').trim();
  const choiceIndex = getChoiceIndex(vote, options);

  if (!name || choiceIndex == null || choiceIndex >= options.length) {
    return null;
  }

  return Object.freeze({
    id: String(vote.id ?? key),
    name,
    choiceIndex,
    choice: options[choiceIndex],
    partySize: choiceIndex,
  });
}

function normalizeAttendanceVote(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const question = String(value.question ?? '').trim();
  const options = Array.isArray(value.options)
    ? value.options.map(option => String(option).trim())
    : null;
  const votes = value.votes;

  if (
    !question ||
    !options ||
    options.length !== ATTENDANCE_VOTE_OPTIONS.length ||
    !options.every(
      (option, index) => option === ATTENDANCE_VOTE_OPTIONS[index]
    ) ||
    !votes ||
    typeof votes !== 'object' ||
    Array.isArray(votes)
  ) {
    return null;
  }

  const voters = Object.entries(votes)
    .map(([key, vote]) => normalizeVoter(vote, key, options))
    .filter(Boolean);

  return Object.freeze({
    id: value.id == null ? null : String(value.id),
    question,
    options: Object.freeze(options),
    voters: Object.freeze(voters),
  });
}

function summarizeAttendanceVote(vote) {
  const normalized = normalizeAttendanceVote(vote);

  if (!normalized) {
    return null;
  }

  const choices = normalized.options.map((label, choiceIndex) => {
    const voters = normalized.voters.filter(
      voter => voter.choiceIndex === choiceIndex
    );

    return Object.freeze({
      label,
      choiceIndex,
      count: voters.length,
      voterNames: Object.freeze(voters.map(voter => voter.name)),
    });
  });
  const totalPeople = normalized.voters.reduce(
    (total, voter) => total + voter.partySize,
    0
  );

  return Object.freeze({
    question: normalized.question,
    choices: Object.freeze(choices),
    totalPeople,
  });
}

module.exports = {
  ATTENDANCE_VOTE_OPTIONS,
  normalizeAttendanceVote,
  summarizeAttendanceVote,
};
