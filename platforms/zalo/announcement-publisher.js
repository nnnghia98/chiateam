const {
  createAnnouncementPublisher,
} = require('../../core/ports/announcement-publisher');
const { createZaloBotClient } = require('./client');

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function createZaloAnnouncementPublisher({
  env = process.env,
  client = null,
  recipientId,
  createClient = createZaloBotClient,
} = {}) {
  if (client != null && typeof client.sendMessage !== 'function') {
    throw new TypeError('Zalo announcement publisher requires sendMessage.');
  }

  if (typeof createClient !== 'function') {
    throw new TypeError('Zalo announcement client factory must be a function.');
  }

  const targetRecipientId = normalizeValue(
    recipientId == null ? env.ZALO_BOT_OWNER_ID : recipientId
  );
  const token = normalizeValue(env.ZALO_BOT_TOKEN);
  let activeClient = client;

  return createAnnouncementPublisher({
    async publish(message) {
      if (!targetRecipientId) {
        throw new Error('Missing ZALO_BOT_OWNER_ID.');
      }

      if (!activeClient) {
        if (!token) {
          throw new Error('Missing ZALO_BOT_TOKEN.');
        }

        activeClient = createClient({ token });
      }

      if (!activeClient || typeof activeClient.sendMessage !== 'function') {
        throw new TypeError(
          'Zalo announcement client factory must return sendMessage.'
        );
      }

      const result = await activeClient.sendMessage(targetRecipientId, message);

      return Object.freeze({
        platform: 'zalo',
        recipientId: targetRecipientId,
        messageId: result?.message_id ?? null,
      });
    },
  });
}

module.exports = {
  createZaloAnnouncementPublisher,
};
