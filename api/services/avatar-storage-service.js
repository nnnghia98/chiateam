const { randomUUID } = require('crypto');

const DEFAULT_AVATAR_BUCKET = 'player-avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === '') {
    const error = new Error(`Missing ${name}`);
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
  return String(value).trim();
}

function getStorageConfig() {
  return {
    supabaseUrl: getRequiredEnv('SUPABASE_URL').replace(/\/+$/, ''),
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    bucket:
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_AVATAR_BUCKET,
  };
}

function stripDataUrl(dataBase64, fallbackContentType) {
  const raw = typeof dataBase64 === 'string' ? dataBase64.trim() : '';
  const match = raw.match(/^data:([^;,]+);base64,(.*)$/s);

  if (!match) {
    return {
      data: raw,
      contentType: fallbackContentType,
    };
  }

  return {
    data: match[2],
    contentType: match[1],
  };
}

function normalizeContentType(contentType) {
  if (typeof contentType !== 'string') {
    return null;
  }

  return contentType.split(';')[0].trim().toLowerCase();
}

function decodeAvatarPayload(payload) {
  const { data, contentType: rawContentType } = stripDataUrl(
    payload?.dataBase64,
    payload?.contentType
  );
  const contentType = normalizeContentType(rawContentType);

  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    const error = new Error('Unsupported avatar image type');
    error.code = 'INVALID_AVATAR_TYPE';
    throw error;
  }

  if (!data) {
    const error = new Error('Missing avatar image data');
    error.code = 'INVALID_AVATAR_DATA';
    throw error;
  }

  const cleanData = data.replace(/\s/g, '');
  if (
    cleanData.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanData)
  ) {
    const error = new Error('Invalid avatar base64 data');
    error.code = 'INVALID_AVATAR_DATA';
    throw error;
  }

  const buffer = Buffer.from(cleanData, 'base64');
  if (buffer.length === 0) {
    const error = new Error('Invalid avatar base64 data');
    error.code = 'INVALID_AVATAR_DATA';
    throw error;
  }

  if (buffer.length > MAX_AVATAR_BYTES) {
    const error = new Error('Avatar image is too large');
    error.code = 'AVATAR_TOO_LARGE';
    throw error;
  }

  return {
    buffer,
    contentType,
    extension: ALLOWED_IMAGE_TYPES.get(contentType),
  };
}

function encodeObjectPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function buildPublicObjectUrl(supabaseUrl, bucket, objectPath) {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
    bucket
  )}/${encodeObjectPath(objectPath)}`;
}

async function uploadPlayerAvatar({ playerNumber, dataBase64, contentType }) {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const image = decodeAvatarPayload({ dataBase64, contentType });
  const objectPath = `players/${playerNumber}/${Date.now()}-${randomUUID()}.${
    image.extension
  }`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(
    bucket
  )}/${encodeObjectPath(objectPath)}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': image.contentType,
      'Cache-Control': '3600',
      'x-upsert': 'true',
    },
    body: image.buffer,
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Supabase avatar upload failed: ${text}`);
    error.code = 'AVATAR_UPLOAD_FAILED';
    error.statusCode = response.status;
    throw error;
  }

  return {
    avatar: buildPublicObjectUrl(supabaseUrl, bucket, objectPath),
    bucket,
    path: objectPath,
    contentType: image.contentType,
    size: image.buffer.length,
  };
}

module.exports = {
  MAX_AVATAR_BYTES,
  uploadPlayerAvatar,
};
