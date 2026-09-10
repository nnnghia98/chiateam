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
  const repository = Object.fromEntries(
    OPERATIONS.map(operation => [
      operation,
      async payload => {
        const response = await request(`/api/zalo-announcements/${operation}`, {
          method: 'POST',
          body: payload,
          timeoutMs: operation === 'refreshSubscriber' ? 2000 : 15000,
        });
        if (response?.ok !== true || !Object.hasOwn(response, 'result')) {
          throw new Error('Invalid Zalo announcement API response.');
        }
        return response.result;
      },
    ])
  );
  repository.uploadImage = async ({ dataBase64, contentType } = {}) => {
    try {
      const response = await request('/api/zalo-announcements/upload-image', {
        method: 'POST',
        body: { dataBase64, contentType },
        timeoutMs: 15000,
      });
      const photoUrl = response?.result?.photoUrl;
      const parsed = typeof photoUrl === 'string' ? new URL(photoUrl) : null;
      if (
        response?.ok !== true ||
        !parsed ||
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error('Invalid image upload API response.');
      }
      return parsed.toString();
    } catch (error) {
      if (error?.code === 'IMAGE_UPLOAD_FAILED') throw error;
      const safe = new Error('Image upload failed.');
      safe.code = 'IMAGE_UPLOAD_FAILED';
      throw safe;
    }
  };
  return Object.freeze(repository);
}

module.exports = { createApiZaloAnnouncementRepository };
