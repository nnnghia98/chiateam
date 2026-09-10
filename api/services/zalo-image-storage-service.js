const { randomUUID } = require('node:crypto');

const MAX_ZALO_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_BUCKET = 'zalo-announcements';
const TYPES = new Map([
  [
    'image/jpeg',
    {
      extension: 'jpg',
      signature: b =>
        b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
  ],
  [
    'image/png',
    {
      extension: 'png',
      signature: b =>
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
  ],
  [
    'image/webp',
    {
      extension: 'webp',
      signature: b =>
        b.length >= 12 &&
        b.subarray(0, 4).toString() === 'RIFF' &&
        b.subarray(8, 12).toString() === 'WEBP',
    },
  ],
]);

function storageError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function decodeImage({ dataBase64, contentType }) {
  if (typeof dataBase64 !== 'string' || !dataBase64)
    throw storageError('INVALID_IMAGE_DATA');
  let data = dataBase64;
  let type = contentType;
  const match = data.match(/^data:([^;,]+);base64,(.*)$/s);
  if (match) {
    type = match[1];
    data = match[2];
  }
  type =
    typeof type === 'string' ? type.split(';')[0].trim().toLowerCase() : '';
  const spec = TYPES.get(type);
  if (!spec) throw storageError('INVALID_IMAGE_TYPE');
  if (
    data.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data) ||
    (data.includes('=') && data.indexOf('=') < data.length - 2)
  ) {
    throw storageError('INVALID_IMAGE_DATA');
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_ZALO_IMAGE_BYTES)
    throw storageError(
      buffer.length ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE_DATA'
    );
  if (buffer.toString('base64') !== data)
    throw storageError('INVALID_IMAGE_DATA');
  if (!spec.signature(buffer)) throw storageError('INVALID_IMAGE_DATA');
  return { buffer, contentType: type, extension: spec.extension };
}

function required(name, env = process.env) {
  const value = env[name];
  if (!value || !String(value).trim())
    throw storageError('STORAGE_NOT_CONFIGURED');
  return String(value).trim();
}

function objectUrl(base, bucket, path) {
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function createZaloImageStorageService({
  fetchImpl = globalThis.fetch,
  env = process.env,
  createId = randomUUID,
  timeoutMs = 15000,
} = {}) {
  if (
    typeof fetchImpl !== 'function' ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  )
    throw new TypeError(
      'Image storage requires a fetch function and positive timeout.'
    );
  return Object.freeze({
    async uploadImage(payload) {
      const image = decodeImage(payload);
      const base = required('SUPABASE_URL', env);
      let parsedBase;
      try {
        parsedBase = new URL(base);
      } catch {
        throw storageError('STORAGE_NOT_CONFIGURED');
      }
      if (
        parsedBase.protocol !== 'https:' ||
        parsedBase.username ||
        parsedBase.password ||
        parsedBase.search ||
        parsedBase.hash
      )
        throw storageError('STORAGE_NOT_CONFIGURED');
      const key = required('SUPABASE_SERVICE_ROLE_KEY', env);
      const bucket = String(
        env.SUPABASE_ZALO_STORAGE_BUCKET || DEFAULT_BUCKET
      ).trim();
      const path = `announcements/${createId()}.${image.extension}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        const bucketResponse = await fetchImpl(
          `${base.replace(/\/+$/, '')}/storage/v1/bucket/${encodeURIComponent(bucket)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${key}`, apikey: key },
            signal: controller.signal,
            redirect: 'error',
          }
        );
        if (!bucketResponse.ok)
          throw storageError('STORAGE_BUCKET_UNAVAILABLE');
        const metadata = await bucketResponse.json();
        if (!metadata || metadata.public !== true)
          throw storageError('STORAGE_BUCKET_PRIVATE');
        response = await fetchImpl(
          `${base.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              apikey: key,
              'Content-Type': image.contentType,
              'x-upsert': 'false',
            },
            body: image.buffer,
            signal: controller.signal,
            redirect: 'error',
          }
        );
      } catch (error) {
        if (
          ['STORAGE_BUCKET_UNAVAILABLE', 'STORAGE_BUCKET_PRIVATE'].includes(
            error.code
          )
        )
          throw error;
        throw storageError(
          'IMAGE_UPLOAD_FAILED',
          error.name === 'AbortError' ? 'Upload timed out' : 'Upload failed'
        );
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw storageError('IMAGE_UPLOAD_FAILED');
      return { photoUrl: objectUrl(base, bucket, path) };
    },
  });
}

module.exports = {
  MAX_ZALO_IMAGE_BYTES,
  createZaloImageStorageService,
  decodeImage,
};
