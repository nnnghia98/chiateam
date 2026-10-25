const {
  createAttendanceVotePublisher,
} = require('../../core/ports/attendance-vote-publisher');
const {
  ATTENDANCE_VOTE_LABELS,
} = require('../../core/use-cases/management/attendance-vote');
const {
  createTelegramChannelConfig,
  resolveTelegramDestination,
} = require('./channel-routing');

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
      const { chatId, threadId } = resolveTelegramDestination(
        channelConfig,
        context,
        'poll'
      );
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
      const pollOptions = vote.options.map(
        option => ATTENDANCE_VOTE_LABELS[String(option)] || String(option)
      );

      try {
        pollMessage = await bot.sendPoll(
          chatId,
          vote.question,
          pollOptions,
          options
        );
      } catch (error) {
        const shouldRetryWithoutThread =
          !channelConfig.routing &&
          threadId != null &&
          (error.message?.includes('message thread not found') ||
            error.message?.includes('TOPIC_CLOSED'));

        if (!shouldRetryWithoutThread) {
          throw error;
        }

        pollMessage = await bot.sendPoll(
          chatId,
          vote.question,
          pollOptions,
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
