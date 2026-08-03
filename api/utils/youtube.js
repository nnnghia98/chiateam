const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const SHORT_YOUTUBE_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);
const YOUTUBE_NOCOOKIE_HOSTS = new Set([
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function parseYoutubeVideoId(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return null;
  }

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch (_error) {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  if (url.username || url.password || url.port) {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let videoId = null;

  if (SHORT_YOUTUBE_HOSTS.has(host) && parts.length === 1) {
    [videoId] = parts;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (parts.length === 1 && parts[0] === 'watch') {
      videoId = url.searchParams.get('v');
    } else if (
      parts.length === 2 &&
      ['embed', 'live', 'shorts'].includes(parts[0])
    ) {
      videoId = parts[1];
    }
  } else if (
    YOUTUBE_NOCOOKIE_HOSTS.has(host) &&
    parts.length === 2 &&
    parts[0] === 'embed'
  ) {
    videoId = parts[1];
  }

  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId || '') ? videoId : null;
}

module.exports = { parseYoutubeVideoId };
