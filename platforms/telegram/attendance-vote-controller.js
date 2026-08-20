const {
  createAttendanceVoteController,
} = require('../../core/ports/attendance-vote-controller');

function isAlreadyClosedError(error) {
  const message = String(error?.message ?? '').toLowerCase();

  return message.includes('poll has already been closed');
}

function createTelegramAttendanceVoteController({ bot } = {}) {
  if (!bot || typeof bot.stopPoll !== 'function') {
    throw new TypeError(
      'Telegram attendance vote controller requires stopPoll.'
    );
  }

  return createAttendanceVoteController({
    async close(reference, context) {
      if (
        reference?.platform &&
        String(reference.platform).toLowerCase() !== 'telegram'
      ) {
        return { closed: false };
      }

      const chatId = reference?.chatId ?? context.conversation.externalId;
      const messageId = reference?.messageId;

      if (chatId == null || messageId == null) {
        return { closed: false };
      }

      try {
        await bot.stopPoll(chatId, messageId);
        return { closed: true };
      } catch (error) {
        if (isAlreadyClosedError(error)) {
          return { closed: true };
        }

        throw error;
      }
    },
  });
}

module.exports = {
  createTelegramAttendanceVoteController,
  isAlreadyClosedError,
};
