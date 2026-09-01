const defaultRepository = require('../routes/two-nikes');

const MAX_TITLE_LENGTH = 160;
const MAX_CREATOR_LENGTH = 80;
const MAX_TIMESTAMP_SECONDS = 86_400;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function normalizeVideoId(value) {
  if (typeof value !== 'string') return null;
  const videoId = value.trim();
  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
}

function createTwoNikeService(repository = defaultRepository) {
  async function listTwoNikes(rawVideoId) {
    const videoId = normalizeVideoId(rawVideoId);
    if (!videoId) return { ok: false, code: 'INVALID_VIDEO_ID' };

    const twoNikes = await repository.listTwoNikesByVideoId(videoId);
    return { ok: true, twoNikes };
  }

  async function createTwoNike(payload, trustedCreatedBy = null) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, code: 'INVALID_PAYLOAD' };
    }

    const videoId = normalizeVideoId(payload.videoId);
    if (!videoId) return { ok: false, code: 'INVALID_VIDEO_ID' };

    const title = normalizeText(payload.title, MAX_TITLE_LENGTH);
    if (!title) return { ok: false, code: 'INVALID_TITLE' };

    // Current admin sessions are role-only, so payload.createdBy is an
    // explicit display name until a trusted user identity is available.
    const createdBy = normalizeText(
      trustedCreatedBy ?? payload.createdBy,
      MAX_CREATOR_LENGTH
    );
    if (!createdBy) return { ok: false, code: 'INVALID_CREATED_BY' };

    const { timestampSeconds } = payload;
    if (
      !Number.isInteger(timestampSeconds) ||
      timestampSeconds < 0 ||
      timestampSeconds > MAX_TIMESTAMP_SECONDS
    ) {
      return { ok: false, code: 'INVALID_TIMESTAMP_SECONDS' };
    }

    const twoNike = await repository.insertTwoNike({
      videoId,
      title,
      timestampSeconds,
      createdBy,
    });
    return { ok: true, twoNike };
  }

  return { createTwoNike, listTwoNikes };
}

const defaultService = createTwoNikeService();

module.exports = {
  ...defaultService,
  createTwoNikeService,
  normalizeVideoId,
};
