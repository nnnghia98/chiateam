const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTelegramAttendanceVotePublisher,
} = require('./attendance-vote-publisher');

const VOTE = Object.freeze({
  question: 'Sân A 20h',
  options: Object.freeze(['0', '+1', '+2', '+3', '+4']),
  createdBy: 'Nghia',
  createdAt: '2026-08-10T10:00:00.000Z',
});

const CONTEXT = Object.freeze({
  actor: { externalId: '123' },
  conversation: { externalId: '-456', threadId: '10' },
});

test('Telegram vote publisher sends a native poll to the announcement thread', async () => {
  const calls = [];
  const publisher = createTelegramAttendanceVotePublisher({
    bot: {
      async sendPoll(chatId, question, options, sendOptions) {
        calls.push({ chatId, question, options, sendOptions });
        return { poll: { id: 'poll-123' }, message_id: 77 };
      },
    },
    channelConfig: {
      chatId: '-100999',
      threads: { announcement: '88' },
    },
  });

  const reference = await publisher.publish(VOTE, CONTEXT);

  assert.deepEqual(calls, [
    {
      chatId: '-100999',
      question: 'Sân A 20h',
      options: ['0', '+1', '+2', '+3', '+4'],
      sendOptions: {
        is_anonymous: false,
        allows_multiple_answers: false,
        explanation: 'Vote được tạo bởi Nghia',
        message_thread_id: '88',
      },
    },
  ]);
  assert.deepEqual(reference, {
    id: 'poll-123',
    platform: 'telegram',
    chatId: '-100999',
    messageId: 77,
  });
});

test('Telegram vote publisher uses the source thread without channel config', async () => {
  const calls = [];
  const publisher = createTelegramAttendanceVotePublisher({
    bot: {
      async sendPoll(chatId, question, options, sendOptions) {
        calls.push({ chatId, question, options, sendOptions });
        return { poll: { id: 'poll-source' }, message_id: 78 };
      },
    },
    channelConfig: { chatId: null, threads: {} },
  });

  const reference = await publisher.publish(VOTE, CONTEXT);

  assert.equal(calls[0].chatId, '-456');
  assert.equal(calls[0].sendOptions.message_thread_id, '10');
  assert.equal(reference.chatId, '-456');
});

test('Telegram vote publisher retries without a closed topic', async () => {
  const calls = [];
  const publisher = createTelegramAttendanceVotePublisher({
    bot: {
      async sendPoll(chatId, question, options, sendOptions) {
        calls.push({ chatId, question, options, sendOptions });
        if (calls.length === 1) {
          throw new Error('TOPIC_CLOSED');
        }
        return { poll: { id: 'poll-retry' }, message_id: 79 };
      },
    },
    channelConfig: {
      chatId: '-100999',
      threads: { announcement: '88' },
    },
  });

  const reference = await publisher.publish(VOTE, CONTEXT);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].sendOptions.message_thread_id, '88');
  assert.equal('message_thread_id' in calls[1].sendOptions, false);
  assert.equal(reference.id, 'poll-retry');
});
