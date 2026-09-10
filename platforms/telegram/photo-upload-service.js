const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TELEGRAM_FILE_BASE_URL = 'https://api.telegram.org/file/bot';

function imageError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function validateFilePath(filePath) {
  const hasUnsafeCharacter = [
    ...(typeof filePath === 'string' ? filePath : ''),
  ].some(character => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
  if (
    typeof filePath !== 'string' ||
    !filePath ||
    filePath.startsWith('/') ||
    hasUnsafeCharacter ||
    /[%\\?#]/.test(filePath) ||
    filePath.split('/').some(part => !part || part === '.' || part === '..')
  ) {
    throw imageError('IMAGE_UPLOAD_FAILED', 'Telegram file path is unsafe.');
  }
  return filePath;
}

function responseLength(response) {
  const value =
    response?.headers?.get?.('content-length') ??
    response?.headers?.['content-length'];
  if (value == null) return null;
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length < 0)
    throw imageError('IMAGE_UPLOAD_FAILED', 'Telegram image size is invalid.');
  if (length > MAX_IMAGE_BYTES)
    throw imageError('IMAGE_TOO_LARGE', 'Image is too large.');
  return length;
}

async function responseBytes(response, signal) {
  if (!response?.ok) throw new Error('Telegram image download failed.');
  responseLength(response);
  if (!response.body) throw new Error('Telegram image download has no body.');
  const chunks = [];
  let total = 0;
  let reader;
  let iterator;
  let complete = false;
  const cancelOnAbort = () => {
    Promise.resolve(reader?.cancel()).catch(() => {});
    Promise.resolve(iterator?.return?.()).catch(() => {});
  };
  signal?.addEventListener('abort', cancelOnAbort, { once: true });
  const add = chunk => {
    const size = chunk?.byteLength ?? chunk?.length;
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      total + size > MAX_IMAGE_BYTES
    ) {
      throw imageError('IMAGE_TOO_LARGE', 'Image is too large.');
    }
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    chunks.push(bytes);
  };
  try {
    if (response.body.getReader) {
      reader = response.body.getReader();
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        add(item.value);
      }
    } else if (response.body[Symbol.asyncIterator]) {
      iterator = response.body[Symbol.asyncIterator]();
      for (;;) {
        const item = await iterator.next();
        if (item.done) break;
        add(item.value);
      }
    } else {
      throw new Error('Telegram image download is not streamed.');
    }
    complete = true;
    return Buffer.concat(chunks);
  } finally {
    signal?.removeEventListener('abort', cancelOnAbort);
    if (!complete) {
      try {
        await reader?.cancel();
      } catch {
        // The stream may already be closed.
      }
      try {
        await iterator?.return?.();
      } catch {
        // The iterator may already be closed.
      }
    }
  }
}

function detectImage(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  throw imageError(
    'INVALID_IMAGE',
    'Downloaded file is not a supported image.'
  );
}

function createTelegramPhotoUploadService({
  bot,
  repository,
  fetcher = fetch,
  timeoutMs = 15000,
} = {}) {
  if (!bot || typeof bot.getFile !== 'function' || !bot.token)
    throw new TypeError('Telegram bot is required.');
  if (!repository || typeof repository.uploadImage !== 'function')
    throw new TypeError('Image repository is required.');
  if (typeof fetcher !== 'function')
    throw new TypeError('Image fetcher is required.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new TypeError('Image upload timeout must be positive.');
  return Object.freeze({
    async upload({ fileId, fileSize } = {}) {
      if (Number.isFinite(fileSize) && fileSize > MAX_IMAGE_BYTES)
        throw imageError('IMAGE_TOO_LARGE', 'Image is too large.');
      try {
        const file = await withTimeout(
          bot.getFile(fileId),
          timeoutMs,
          'Telegram getFile timed out.'
        );
        if (
          Number.isFinite(file?.file_size) &&
          file.file_size > MAX_IMAGE_BYTES
        )
          throw imageError('IMAGE_TOO_LARGE', 'Image is too large.');
        const path = validateFilePath(file?.file_path);
        const downloadController = new AbortController();
        const response = await withTimeout(
          fetcher(`${TELEGRAM_FILE_BASE_URL}${bot.token}/${path}`, {
            redirect: 'error',
            signal: downloadController.signal,
          }),
          timeoutMs,
          'Telegram image download timed out.'
        ).catch(error => {
          downloadController.abort();
          throw error;
        });
        const bytes = await withTimeout(
          responseBytes(response, downloadController.signal),
          timeoutMs,
          'Telegram image download timed out.'
        ).catch(error => {
          downloadController.abort();
          throw error;
        });
        const contentType = detectImage(bytes);
        const photoUrl = await withTimeout(
          repository.uploadImage({
            dataBase64: bytes.toString('base64'),
            contentType,
          }),
          timeoutMs,
          'Image upload timed out.'
        );
        return { photoUrl };
      } catch (error) {
        if (
          error?.code === 'IMAGE_TOO_LARGE' ||
          error?.code === 'INVALID_IMAGE'
        )
          throw error;
        if (error?.code === 'IMAGE_UPLOAD_FAILED') throw error;
        throw imageError('IMAGE_UPLOAD_FAILED', 'Image upload failed.');
      }
    },
  });
}

module.exports = { MAX_IMAGE_BYTES, createTelegramPhotoUploadService };
