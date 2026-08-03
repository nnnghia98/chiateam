const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatTimestamp,
  validateHighlightPayload,
  validateVideoSourcesPayload,
} = require('./match-media-service');

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function source(overrides = {}) {
  return {
    slot: 1,
    url: VIDEO_URL,
    ...overrides,
  };
}

test('video source validation accepts both slots and normalizes values', () => {
  assert.deepEqual(validateVideoSourcesPayload({ sources: [] }), {
    ok: true,
    sources: [],
  });

  const result = validateVideoSourcesPayload({
    sources: [
      source({
        title: '  Cam 1  ',
        offsetSeconds: -86_400,
        videoId: 'untrusted-id',
      }),
      source({
        slot: 2,
        provider: ' YouTube ',
        title: '   ',
        offsetSeconds: 86_400,
      }),
    ],
  });

  assert.deepEqual(result, {
    ok: true,
    sources: [
      {
        slot: 1,
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        url: VIDEO_URL,
        title: 'Cam 1',
        offsetSeconds: -86_400,
      },
      {
        slot: 2,
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        url: VIDEO_URL,
        title: null,
        offsetSeconds: 86_400,
      },
    ],
  });
});

test('video source validation rejects invalid and duplicate slots', () => {
  assert.equal(
    validateVideoSourcesPayload({ sources: [source({ slot: 3 })] }).code,
    'INVALID_SOURCE_SLOT'
  );
  assert.equal(
    validateVideoSourcesPayload({ sources: [source({ slot: '1' })] }).code,
    'INVALID_SOURCE_SLOT'
  );
  assert.equal(
    validateVideoSourcesPayload({
      sources: [source(), source({ title: 'duplicate' })],
    }).code,
    'DUPLICATE_SOURCE_SLOT'
  );
});

test('video source validation rejects more than two sources', () => {
  const result = validateVideoSourcesPayload({
    sources: [source(), source({ slot: 2 }), source({ slot: 1 })],
  });

  assert.deepEqual(result, { ok: false, code: 'INVALID_SOURCES' });
});

test('video source validation rejects invalid offsets and URLs', () => {
  for (const offsetSeconds of [-86_401, 86_401, 1.5, '12', null]) {
    assert.equal(
      validateVideoSourcesPayload({
        sources: [source({ offsetSeconds })],
      }).code,
      'INVALID_OFFSET_SECONDS'
    );
  }

  assert.equal(
    validateVideoSourcesPayload({
      sources: [source({ url: 'https://example.com/video' })],
    }).code,
    'INVALID_YOUTUBE_URL'
  );

  assert.equal(
    validateVideoSourcesPayload({
      sources: [source({ title: 'x'.repeat(201) })],
    }).code,
    'INVALID_SOURCES'
  );
  assert.equal(
    validateVideoSourcesPayload({
      sources: [source({ provider: 'vimeo' })],
    }).code,
    'INVALID_SOURCES'
  );
});

test('highlight validation enforces timestamp range and integer type', () => {
  for (const timestampSeconds of [0, 86_400]) {
    assert.equal(
      validateHighlightPayload({
        timestampSeconds,
        caption: 'Goal',
      }).ok,
      true
    );
  }

  for (const timestampSeconds of [-1, 86_401, 1.5, '930']) {
    assert.equal(
      validateHighlightPayload({
        timestampSeconds,
        caption: 'Goal',
      }).code,
      'INVALID_TIMESTAMP_SECONDS'
    );
  }
});

test('highlight validation trims captions and enforces caption length', () => {
  assert.deepEqual(
    validateHighlightPayload({
      timestampSeconds: 930,
      caption: '  Great goal  ',
    }),
    {
      ok: true,
      highlight: {
        timestampSeconds: 930,
        caption: 'Great goal',
      },
    }
  );

  for (const caption of ['', '   ', 'x'.repeat(501), null]) {
    assert.equal(
      validateHighlightPayload({ timestampSeconds: 930, caption }).code,
      'INVALID_CAPTION'
    );
  }
});

test('highlight validation accepts null or valid preferred source slots', () => {
  for (const preferredSourceSlot of [null, 1, 2]) {
    const result = validateHighlightPayload({
      timestampSeconds: 930,
      caption: 'Goal',
      preferredSourceSlot,
    });

    assert.equal(result.ok, true);
    assert.equal(result.highlight.preferredSourceSlot, preferredSourceSlot);
  }

  for (const preferredSourceSlot of [0, 3, '1']) {
    assert.equal(
      validateHighlightPayload({
        timestampSeconds: 930,
        caption: 'Goal',
        preferredSourceSlot,
      }).code,
      'INVALID_PREFERRED_SOURCE_SLOT'
    );
  }
});

test('partial highlight validation rejects an empty update', () => {
  assert.deepEqual(validateHighlightPayload({}, { partial: true }), {
    ok: false,
    code: 'NO_HIGHLIGHT_FIELDS',
  });
  assert.deepEqual(
    validateHighlightPayload({ createdBy: 'attacker' }, { partial: true }),
    {
      ok: false,
      code: 'NO_HIGHLIGHT_FIELDS',
    }
  );
});

test('formatTimestamp formats match timeline values', () => {
  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(930), '15:30');
  assert.equal(formatTimestamp(3661), '01:01:01');
});
