function requireFunction(value, field) {
  if (typeof value !== 'function') {
    throw new TypeError(`${field} must be a function.`);
  }

  return value;
}

function createAnnouncementPublisher({ publish } = {}) {
  const publishAnnouncement = requireFunction(
    publish,
    'announcement publisher publish'
  );

  return Object.freeze({
    async publish(message, context) {
      if (typeof message !== 'string' || message.length === 0) {
        throw new TypeError('Announcement publisher requires a message.');
      }

      return publishAnnouncement(message, context);
    },
  });
}

function assertAnnouncementPublisher(publisher) {
  if (!publisher || typeof publisher.publish !== 'function') {
    throw new TypeError('A valid announcement publisher is required.');
  }

  return publisher;
}

module.exports = {
  assertAnnouncementPublisher,
  createAnnouncementPublisher,
};
