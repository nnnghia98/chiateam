const {
  createAttendanceVotePublisher,
} = require('../../core/ports/attendance-vote-publisher');
const { createTelegramChannelConfig } = require('./adapter');

function createTelegramAttendanceVotePublisher({
  bot,
  channelConfig = createTelegramChannelConfig(),
} = {}) {
  if (!bot || typeof bot.sendPoll !== 'function') {
    throw new TypeError(
      'Telegram attendance vote publisher requires sendPoll.'
    );
  }

  return createAttendanceVotePublisher({
    async publish(vote, context) {
      const hasConfiguredChat = Boolean(channelConfig.chatId);
      const chatId = channelConfig.chatId || context.conversation.externalId;
      const threadId =
        channelConfig.threads?.announcement ??
        (hasConfiguredChat ? null : context.conversation.threadId);
      const baseOptions = {
        is_anonymous: false,
        allows_multiple_answers: false,
        explanation: `Vote được tạo bởi ${vote.createdBy}`,
      };
      const options =
        threadId == null
          ? baseOptions
          : { ...baseOptions, message_thread_id: threadId };
      let pollMessage;

      try {
        pollMessage = await bot.sendPoll(
          chatId,
          vote.question,
          [...vote.options],
          options
        );
      } catch (error) {
        const shouldRetryWithoutThread =
          threadId != null &&
          (error.message?.includes('message thread not found') ||
            error.message?.includes('TOPIC_CLOSED'));

        if (!shouldRetryWithoutThread) {
          throw error;
        }

        pollMessage = await bot.sendPoll(
          chatId,
          vote.question,
          [...vote.options],
          baseOptions
        );
      }

      if (pollMessage?.poll?.id == null) {
        throw new TypeError('Telegram sendPoll returned no poll id.');
      }

      return {
        id: pollMessage.poll.id,
        platform: 'telegram',
        chatId,
        messageId: pollMessage.message_id ?? null,
      };
    },
  });
}

module.exports = {
  createTelegramAttendanceVotePublisher,
};
