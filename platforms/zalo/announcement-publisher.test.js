const test = require('node:test');
const assert = require('node:assert/strict');

const { createZaloAnnouncementPublisher } = require('./announcement-publisher');

test('Zalo announcement publisher sends to the configured owner', async () => {
  const calls = [];
  const publisher = createZaloAnnouncementPublisher({
    client: {
      async sendMessage(chatId, message) {
        calls.push({ chatId, message });
        return { message_id: 'message-1' };
      },
    },
    recipientId: 'zalo-owner',
  });

  const reference = await publisher.publish('Hello Zalo', {});

  assert.deepEqual(calls, [{ chatId: 'zalo-owner', message: 'Hello Zalo' }]);
  assert.deepEqual(reference, {
    platform: 'zalo',
    recipientId: 'zalo-owner',
    messageId: 'message-1',
  });
});

test('Zalo announcement publisher lazily creates one non-polling client', async () => {
  const created = [];
  const calls = [];
  const publisher = createZaloAnnouncementPublisher({
    env: {
      ZALO_BOT_TOKEN: 'test-token',
      ZALO_BOT_OWNER_ID: 'zalo-owner',
    },
    createClient(options) {
      created.push(options);
      return {
        async sendMessage(chatId, message) {
          calls.push({ chatId, message });
          return {};
        },
        startPolling() {
          throw new Error('Publisher must not start polling.');
        },
      };
    },
  });

  await publisher.publish('First', {});
  await publisher.publish('Second', {});

  assert.deepEqual(created, [{ token: 'test-token' }]);
  assert.deepEqual(calls, [
    { chatId: 'zalo-owner', message: 'First' },
    { chatId: 'zalo-owner', message: 'Second' },
  ]);
});

test('Zalo announcement publisher fails closed without owner or token', async () => {
  const missingOwner = createZaloAnnouncementPublisher({ env: {} });
  const missingToken = createZaloAnnouncementPublisher({
    env: { ZALO_BOT_OWNER_ID: 'zalo-owner' },
  });

  await assert.rejects(missingOwner.publish('Hello', {}), /ZALO_BOT_OWNER_ID/);
  await assert.rejects(missingToken.publish('Hello', {}), /ZALO_BOT_TOKEN/);
});
