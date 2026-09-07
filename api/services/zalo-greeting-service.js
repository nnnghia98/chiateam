const { createZaloGreetingRepository } = require('../routes/zalo-greetings');

const validId = value =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 256 &&
  !/[\p{Cc}\s]/u.test(value);

function createZaloGreetingService({
  repository = createZaloGreetingRepository(),
} = {}) {
  return Object.freeze({
    async claim(payload) {
      if (
        payload?.chatType !== 'private' ||
        !validId(payload.userId) ||
        !validId(payload.chatId)
      ) {
        return { ok: false, code: 'INVALID_GREETING_REQUEST' };
      }
      const claimed = await repository.claim({
        userId: payload.userId,
        chatId: payload.chatId,
      });
      return { ok: true, claimed };
    },
  });
}

module.exports = { createZaloGreetingService };
