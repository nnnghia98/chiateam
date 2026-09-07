const { requestJson } = require('../../bot/utils/api-client');

const OPERATIONS = [
  'subscribe',
  'unsubscribe',
  'refreshSubscriber',
  'subscribers',
  'prepare',
  'claim',
  'next',
  'record',
  'finish',
  'cancel',
  'status',
];

function createApiZaloAnnouncementRepository({ request = requestJson } = {}) {
  return Object.freeze(
    Object.fromEntries(
      OPERATIONS.map(operation => [
        operation,
        async payload => {
          const response = await request(
            `/api/zalo-announcements/${operation}`,
            {
              method: 'POST',
              body: payload,
              timeoutMs: operation === 'refreshSubscriber' ? 2000 : 15000,
            }
          );
          if (response?.ok !== true || !Object.hasOwn(response, 'result')) {
            throw new Error('Invalid Zalo announcement API response.');
          }
          return response.result;
        },
      ])
    )
  );
}

module.exports = { createApiZaloAnnouncementRepository };
