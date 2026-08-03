const test = require('node:test');
const assert = require('node:assert/strict');

const { parseYoutubeVideoId } = require('./youtube');

const VIDEO_ID = 'dQw4w9WgXcQ';

test('parseYoutubeVideoId supports approved YouTube URL forms', () => {
  const urls = [
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
  ];

  for (const url of urls) {
    assert.equal(parseYoutubeVideoId(url), VIDEO_ID, url);
  }
});

test('parseYoutubeVideoId rejects spoofed and unsupported hosts', () => {
  const urls = [
    `https://youtube.com.example.com/watch?v=${VIDEO_ID}`,
    `https://example.com/youtu.be/${VIDEO_ID}`,
    `https://music.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com:8443/watch?v=${VIDEO_ID}`,
  ];

  for (const url of urls) {
    assert.equal(parseYoutubeVideoId(url), null, url);
  }
});

test('parseYoutubeVideoId rejects malformed video IDs and paths', () => {
  const urls = [
    'https://www.youtube.com/watch?v=too-short',
    'https://www.youtube.com/watch?v=dQw4w9WgXc!',
    `https://youtu.be/${VIDEO_ID}/extra`,
    `https://www.youtube.com/live/${VIDEO_ID}/extra`,
    'not a url',
  ];

  for (const url of urls) {
    assert.equal(parseYoutubeVideoId(url), null, url);
  }
});
