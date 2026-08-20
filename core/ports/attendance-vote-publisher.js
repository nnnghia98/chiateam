function requireFunction(value, field) {
  if (typeof value !== 'function') {
    throw new TypeError(`${field} must be a function.`);
  }

  return value;
}

function normalizeReference(reference) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
    throw new TypeError('Attendance vote publisher must return a reference.');
  }

  const id = String(reference.id ?? '').trim();
  const platform = String(reference.platform ?? '')
    .trim()
    .toLowerCase();

  if (!id || !platform) {
    throw new TypeError('Attendance vote reference requires id and platform.');
  }

  return Object.freeze({
    id,
    platform,
    chatId:
      reference.chatId == null ? null : String(reference.chatId).trim() || null,
    messageId: reference.messageId ?? null,
  });
}

function createAttendanceVotePublisher({ publish } = {}) {
  const publishVote = requireFunction(
    publish,
    'attendance vote publisher publish'
  );

  return Object.freeze({
    async publish(vote, context) {
      return normalizeReference(await publishVote(vote, context));
    },
  });
}

function assertAttendanceVotePublisher(publisher) {
  if (!publisher || typeof publisher.publish !== 'function') {
    throw new TypeError('A valid attendance vote publisher is required.');
  }

  return publisher;
}

module.exports = {
  assertAttendanceVotePublisher,
  createAttendanceVotePublisher,
};
