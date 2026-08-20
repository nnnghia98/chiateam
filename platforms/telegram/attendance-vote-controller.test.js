const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTelegramAttendanceVoteController,
} = require('./attendance-vote-controller');

const CONTEXT = Object.freeze({
  conversation: { externalId: '-456', threadId: null },
});

test('Telegram vote controller closes the stored poll', async () => {
  const calls = [];
  const controller = createTelegramAttendanceVoteController({
    bot: {
      async stopPoll(chatId, messageId) {
        calls.push({ chatId, messageId });
      },
    },
  });

  const result = await controller.close(
    { platform: 'telegram', chatId: '-100999', messageId: 77 },
    CONTEXT
  );

  assert.deepEqual(calls, [{ chatId: '-100999', messageId: 77 }]);
  assert.deepEqual(result, { closed: true });
});

test('Telegram vote controller supports old references and closed polls', async () => {
  const controller = createTelegramAttendanceVoteController({
    bot: {
      async stopPoll(chatId, messageId) {
        assert.equal(chatId, '-456');
        assert.equal(messageId, 77);
        throw new Error('Bad Request: poll has already been closed');
      },
    },
  });

  assert.deepEqual(await controller.close({ messageId: 77 }, CONTEXT), {
    closed: true,
  });
});

test('Telegram vote controller leaves unsupported references to fallback', async () => {
  let closeCount = 0;
  const controller = createTelegramAttendanceVoteController({
    bot: {
      async stopPoll() {
        closeCount += 1;
      },
    },
  });

  assert.deepEqual(
    await controller.close({ platform: 'zalo', messageId: 77 }, CONTEXT),
    { closed: false }
  );
  assert.deepEqual(await controller.close({ platform: 'telegram' }, CONTEXT), {
    closed: false,
  });
  assert.equal(closeCount, 0);
});
