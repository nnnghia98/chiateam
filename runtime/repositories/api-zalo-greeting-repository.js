const { requestJson } = require('../../bot/utils/api-client');

function createApiZaloGreetingRepository({ request = requestJson } = {}) {
  return Object.freeze({
    async claim(identity) {
      const result = await request('/api/zalo-greetings/claim', {
        method: 'POST',
        body: identity,
        timeoutMs: 2000,
      });
      if (result?.ok !== true || typeof result.claimed !== 'boolean') {
        throw new Error('Invalid Zalo greeting API response.');
      }
      return result.claimed;
    },
  });
}

module.exports = { createApiZaloGreetingRepository };
