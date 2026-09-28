const ATTENDANCE_VOTE_OPTIONS = Object.freeze(['0', '1']);
const ATTENDANCE_VOTE_LABELS = Object.freeze({
  0: '🫷 Thôi',
  1: '⚽️ Đá',
});
const LEGACY_ATTENDANCE_VOTE_OPTIONS = Object.freeze([
  '0',
  '+1',
  '+2',
  '+3',
  '+4',
]);

function normalizeVotePlatform(value, fallback = 'telegram') {
  return (
    String(value ?? fallback)
      .trim()
      .toLowerCase() || fallback
  );
}

function getVoteSchema(options) {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalized = options.map(option => String(option).trim());
  const matches = expected =>
    normalized.length === expected.length &&
    normalized.every((option, index) => option === expected[index]);

  if (matches(ATTENDANCE_VOTE_OPTIONS)) {
    return { options: normalized, legacy: false };
  }

  if (matches(LEGACY_ATTENDANCE_VOTE_OPTIONS)) {
    return { options: normalized, legacy: true };
  }

  return null;
}

function normalizeVoterChoice(vote, schema) {
  const namedChoice = vote.choice ?? vote.option;

  if (typeof namedChoice === 'string') {
    const choice = namedChoice.trim();

    // New binary choices can appear in an older active poll after an upgrade.
    if (choice === '0' || choice === '1') {
      const choiceIndex = Number(choice);
      return { choiceIndex, partySize: choiceIndex };
    }

    const legacyIndex = schema.options.indexOf(choice);

    if (legacyIndex >= 0) {
      const choiceIndex = schema.legacy && legacyIndex > 0 ? 1 : legacyIndex;
      return {
        choiceIndex,
        partySize: schema.legacy ? legacyIndex : choiceIndex,
      };
    }
  }

  const legacyIndex = vote.optionIndex ?? vote.options?.[0];

  if (!Number.isInteger(legacyIndex) || legacyIndex < 0) {
    return null;
  }

  const choiceIndex = schema.legacy && legacyIndex > 0 ? 1 : legacyIndex;

  if (choiceIndex >= ATTENDANCE_VOTE_OPTIONS.length) {
    return null;
  }

  return {
    choiceIndex,
    partySize: schema.legacy ? legacyIndex : choiceIndex,
  };
}

function normalizeVoter(vote, key, schema, defaultPlatform) {
  if (!vote || typeof vote !== 'object' || Array.isArray(vote)) {
    return null;
  }

  const name = String(vote.name ?? '').trim();
  const normalizedChoice = normalizeVoterChoice(vote, schema);

  if (
    !name ||
    !normalizedChoice ||
    normalizedChoice.choiceIndex >= ATTENDANCE_VOTE_OPTIONS.length
  ) {
    return null;
  }

  return Object.freeze({
    id: String(vote.id ?? key),
    name,
    platform: normalizeVotePlatform(vote.platform, defaultPlatform),
    choiceIndex: normalizedChoice.choiceIndex,
    choice: ATTENDANCE_VOTE_OPTIONS[normalizedChoice.choiceIndex],
    partySize: normalizedChoice.partySize,
  });
}

function normalizeAttendanceVote(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const question = String(value.question ?? '').trim();
  const schema = getVoteSchema(value.options);
  const votes = value.votes;

  if (
    !question ||
    !schema ||
    !votes ||
    typeof votes !== 'object' ||
    Array.isArray(votes)
  ) {
    return null;
  }

  const defaultPlatform = normalizeVotePlatform(value.platform);
  const voters = Object.entries(votes)
    .map(([key, vote]) => normalizeVoter(vote, key, schema, defaultPlatform))
    .filter(Boolean);

  return Object.freeze({
    id: value.id == null ? null : String(value.id),
    question,
    options: ATTENDANCE_VOTE_OPTIONS,
    voters: Object.freeze(voters),
    platform: defaultPlatform,
  });
}

function summarizeAttendanceVote(vote) {
  const normalized = normalizeAttendanceVote(vote);

  if (!normalized) {
    return null;
  }

  const choices = normalized.options.map((value, choiceIndex) => {
    const voters = normalized.voters.filter(
      voter => voter.choiceIndex === choiceIndex
    );

    return Object.freeze({
      label: ATTENDANCE_VOTE_LABELS[value],
      value,
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
  ATTENDANCE_VOTE_LABELS,
  ATTENDANCE_VOTE_OPTIONS,
  LEGACY_ATTENDANCE_VOTE_OPTIONS,
  normalizeAttendanceVote,
  summarizeAttendanceVote,
};
