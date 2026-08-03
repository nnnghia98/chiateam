const { db } = require('../db/config');
const { parseYoutubeVideoId } = require('../utils/youtube');

const MAX_CAPTION_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;
const MAX_TIMESTAMP_SECONDS = 86_400;
const MAX_OFFSET_SECONDS = 86_400;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

const VIDEO_SOURCE_COLUMNS = `
  id,
  match_id,
  slot,
  provider,
  video_id,
  source_url,
  title,
  offset_seconds,
  created_at,
  updated_at
`;

const HIGHLIGHT_COLUMNS = `
  id,
  match_id,
  timestamp_seconds,
  caption,
  preferred_source_slot,
  created_by,
  created_at,
  updated_at
`;

let tablesReadyPromise = null;

async function ensureMatchMediaTables() {
  if (tablesReadyPromise) return tablesReadyPromise;

  tablesReadyPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS match_video_sources (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
        provider TEXT NOT NULL DEFAULT 'youtube' CHECK (provider = 'youtube'),
        video_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        title TEXT,
        offset_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (match_id, slot)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS match_highlights (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        timestamp_seconds INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
        caption TEXT NOT NULL,
        preferred_source_slot SMALLINT CHECK (
          preferred_source_slot IS NULL OR preferred_source_slot IN (1, 2)
        ),
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS match_highlights_timeline_idx
      ON match_highlights (match_id, timestamp_seconds, id)
    `);
  })().catch(error => {
    tablesReadyPromise = null;
    throw error;
  });

  return tablesReadyPromise;
}

function normalizePositiveInteger(rawValue) {
  let value = rawValue;

  if (typeof rawValue === 'string') {
    if (!/^\d+$/.test(rawValue)) return null;
    value = Number(rawValue);
  }

  return Number.isSafeInteger(value) &&
    value > 0 &&
    value <= POSTGRES_INTEGER_MAX
    ? value
    : null;
}

function formatTimestamp(timestampSeconds) {
  const totalSeconds = Number(timestampSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteSecond = `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${minuteSecond}`
    : minuteSecond;
}

function mapVideoSource(row) {
  return {
    id: Number(row.id),
    slot: Number(row.slot),
    provider: row.provider,
    videoId: row.video_id,
    url: row.source_url,
    title: row.title,
    offsetSeconds: Number(row.offset_seconds),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHighlight(row) {
  const timestampSeconds = Number(row.timestamp_seconds);

  return {
    id: Number(row.id),
    matchId: Number(row.match_id),
    timestampSeconds,
    timestamp: formatTimestamp(timestampSeconds),
    caption: row.caption,
    preferredSourceSlot:
      row.preferred_source_slot == null
        ? null
        : Number(row.preferred_source_slot),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateVideoSourcesPayload(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Array.isArray(payload.sources) ||
    payload.sources.length > 2
  ) {
    return { ok: false, code: 'INVALID_SOURCES' };
  }

  const slots = new Set();
  const sources = [];

  for (const rawSource of payload.sources) {
    if (
      !rawSource ||
      typeof rawSource !== 'object' ||
      Array.isArray(rawSource)
    ) {
      return { ok: false, code: 'INVALID_SOURCES' };
    }

    const { slot } = rawSource;
    if (!Number.isInteger(slot) || (slot !== 1 && slot !== 2)) {
      return { ok: false, code: 'INVALID_SOURCE_SLOT' };
    }
    if (slots.has(slot)) {
      return { ok: false, code: 'DUPLICATE_SOURCE_SLOT' };
    }
    slots.add(slot);

    let provider = 'youtube';
    if (rawSource.provider != null) {
      if (typeof rawSource.provider !== 'string') {
        return { ok: false, code: 'INVALID_SOURCES' };
      }
      provider = rawSource.provider.trim().toLowerCase();
    }
    if (provider !== 'youtube') {
      return { ok: false, code: 'INVALID_SOURCES' };
    }

    const url = typeof rawSource.url === 'string' ? rawSource.url.trim() : '';
    const videoId = parseYoutubeVideoId(url);
    if (!videoId) {
      return { ok: false, code: 'INVALID_YOUTUBE_URL' };
    }

    let title = null;
    if (rawSource.title != null && rawSource.title !== '') {
      if (typeof rawSource.title !== 'string') {
        return { ok: false, code: 'INVALID_SOURCES' };
      }
      title = rawSource.title.trim() || null;
      if (title && title.length > MAX_TITLE_LENGTH) {
        return { ok: false, code: 'INVALID_SOURCES' };
      }
    }

    const offsetSeconds = Object.prototype.hasOwnProperty.call(
      rawSource,
      'offsetSeconds'
    )
      ? rawSource.offsetSeconds
      : 0;
    if (
      !Number.isInteger(offsetSeconds) ||
      offsetSeconds < -MAX_OFFSET_SECONDS ||
      offsetSeconds > MAX_OFFSET_SECONDS
    ) {
      return { ok: false, code: 'INVALID_OFFSET_SECONDS' };
    }

    sources.push({ slot, provider, videoId, url, title, offsetSeconds });
  }

  return { ok: true, sources };
}

function validateHighlightPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      code: partial ? 'NO_HIGHLIGHT_FIELDS' : 'INVALID_TIMESTAMP_SECONDS',
    };
  }

  const highlight = {};
  let fieldCount = 0;

  if (Object.prototype.hasOwnProperty.call(payload, 'timestampSeconds')) {
    const { timestampSeconds } = payload;
    if (
      !Number.isInteger(timestampSeconds) ||
      timestampSeconds < 0 ||
      timestampSeconds > MAX_TIMESTAMP_SECONDS
    ) {
      return { ok: false, code: 'INVALID_TIMESTAMP_SECONDS' };
    }
    highlight.timestampSeconds = timestampSeconds;
    fieldCount += 1;
  } else if (!partial) {
    return { ok: false, code: 'INVALID_TIMESTAMP_SECONDS' };
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'caption')) {
    if (typeof payload.caption !== 'string') {
      return { ok: false, code: 'INVALID_CAPTION' };
    }

    const caption = payload.caption.trim();
    if (!caption || caption.length > MAX_CAPTION_LENGTH) {
      return { ok: false, code: 'INVALID_CAPTION' };
    }
    highlight.caption = caption;
    fieldCount += 1;
  } else if (!partial) {
    return { ok: false, code: 'INVALID_CAPTION' };
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'preferredSourceSlot')) {
    const { preferredSourceSlot } = payload;
    if (
      preferredSourceSlot !== null &&
      preferredSourceSlot !== 1 &&
      preferredSourceSlot !== 2
    ) {
      return { ok: false, code: 'INVALID_PREFERRED_SOURCE_SLOT' };
    }
    highlight.preferredSourceSlot = preferredSourceSlot;
    fieldCount += 1;
  }

  if (partial && fieldCount === 0) {
    return { ok: false, code: 'NO_HIGHLIGHT_FIELDS' };
  }

  return { ok: true, highlight };
}

async function matchExists(matchId, client = db) {
  const { rows } = await client.query(
    'SELECT 1 FROM matches WHERE id = $1 LIMIT 1',
    [matchId]
  );
  return rows.length > 0;
}

async function listVideoSources(rawMatchId) {
  const matchId = normalizePositiveInteger(rawMatchId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };

  await ensureMatchMediaTables();
  if (!(await matchExists(matchId))) {
    return { ok: false, code: 'MATCH_NOT_FOUND' };
  }

  const { rows } = await db.query(
    `SELECT ${VIDEO_SOURCE_COLUMNS}
     FROM match_video_sources
     WHERE match_id = $1
     ORDER BY slot`,
    [matchId]
  );
  return { ok: true, matchId, sources: rows.map(mapVideoSource) };
}

async function replaceVideoSources(rawMatchId, payload) {
  const matchId = normalizePositiveInteger(rawMatchId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };

  const validation = validateVideoSourcesPayload(payload);
  if (!validation.ok) return validation;

  await ensureMatchMediaTables();
  const client = await db.connect();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const matchResult = await client.query(
      'SELECT id FROM matches WHERE id = $1 FOR UPDATE',
      [matchId]
    );
    if (matchResult.rows.length === 0) {
      try {
        await client.query('ROLLBACK');
      } finally {
        transactionOpen = false;
      }
      return { ok: false, code: 'MATCH_NOT_FOUND' };
    }

    for (const source of validation.sources) {
      await client.query(
        `INSERT INTO match_video_sources
          (match_id, slot, provider, video_id, source_url, title, offset_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (match_id, slot) DO UPDATE SET
           provider = EXCLUDED.provider,
           video_id = EXCLUDED.video_id,
           source_url = EXCLUDED.source_url,
           title = EXCLUDED.title,
           offset_seconds = EXCLUDED.offset_seconds,
           updated_at = NOW()`,
        [
          matchId,
          source.slot,
          source.provider,
          source.videoId,
          source.url,
          source.title,
          source.offsetSeconds,
        ]
      );
    }

    const submittedSlots = validation.sources.map(source => source.slot);
    if (submittedSlots.length > 0) {
      await client.query(
        `DELETE FROM match_video_sources
         WHERE match_id = $1
           AND slot <> ALL($2::smallint[])`,
        [matchId, submittedSlots]
      );
    } else {
      await client.query(
        'DELETE FROM match_video_sources WHERE match_id = $1',
        [matchId]
      );
    }

    const { rows } = await client.query(
      `SELECT ${VIDEO_SOURCE_COLUMNS}
       FROM match_video_sources
       WHERE match_id = $1
       ORDER BY slot`,
      [matchId]
    );
    const sources = rows.map(mapVideoSource);

    await client.query('COMMIT');
    transactionOpen = false;
    return { ok: true, matchId, sources };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackError) {
        // Keep the original database error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function listHighlights(rawMatchId, rawSourceSlot = null) {
  const matchId = normalizePositiveInteger(rawMatchId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };

  let sourceSlot = null;
  if (rawSourceSlot !== null) {
    if (rawSourceSlot === 1 || rawSourceSlot === '1') {
      sourceSlot = 1;
    } else if (rawSourceSlot === 2 || rawSourceSlot === '2') {
      sourceSlot = 2;
    } else {
      return { ok: false, code: 'INVALID_SOURCE_SLOT' };
    }
  }

  await ensureMatchMediaTables();
  if (!(await matchExists(matchId))) {
    return { ok: false, code: 'MATCH_NOT_FOUND' };
  }

  const values = [matchId];
  const sourceFilter =
    sourceSlot == null ? '' : 'AND preferred_source_slot = $2';
  if (sourceSlot != null) values.push(sourceSlot);

  const { rows } = await db.query(
    `SELECT ${HIGHLIGHT_COLUMNS}
     FROM match_highlights
     WHERE match_id = $1 ${sourceFilter}
     ORDER BY timestamp_seconds, id`,
    values
  );
  return { ok: true, matchId, highlights: rows.map(mapHighlight) };
}

async function createHighlight(rawMatchId, payload, createdBy) {
  const matchId = normalizePositiveInteger(rawMatchId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };

  const validation = validateHighlightPayload(payload);
  if (!validation.ok) return validation;

  await ensureMatchMediaTables();
  if (!(await matchExists(matchId))) {
    return { ok: false, code: 'MATCH_NOT_FOUND' };
  }

  const { highlight } = validation;
  const { rows } = await db.query(
    `INSERT INTO match_highlights
      (match_id, timestamp_seconds, caption, preferred_source_slot, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${HIGHLIGHT_COLUMNS}`,
    [
      matchId,
      highlight.timestampSeconds,
      highlight.caption,
      highlight.preferredSourceSlot ?? null,
      createdBy == null ? null : String(createdBy),
    ]
  );
  return { ok: true, highlight: mapHighlight(rows[0]) };
}

async function updateHighlight(rawMatchId, rawHighlightId, payload) {
  const matchId = normalizePositiveInteger(rawMatchId);
  const highlightId = normalizePositiveInteger(rawHighlightId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };
  if (!highlightId) return { ok: false, code: 'INVALID_HIGHLIGHT_ID' };

  const validation = validateHighlightPayload(payload, { partial: true });
  if (!validation.ok) return validation;

  await ensureMatchMediaTables();
  const fields = [];
  const values = [];
  const { highlight } = validation;

  if (Object.prototype.hasOwnProperty.call(highlight, 'timestampSeconds')) {
    values.push(highlight.timestampSeconds);
    fields.push(`timestamp_seconds = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(highlight, 'caption')) {
    values.push(highlight.caption);
    fields.push(`caption = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(highlight, 'preferredSourceSlot')) {
    values.push(highlight.preferredSourceSlot);
    fields.push(`preferred_source_slot = $${values.length}`);
  }

  fields.push('updated_at = NOW()');
  values.push(matchId);
  const matchIdPlaceholder = values.length;
  values.push(highlightId);
  const highlightIdPlaceholder = values.length;

  const { rows } = await db.query(
    `UPDATE match_highlights
     SET ${fields.join(', ')}
     WHERE match_id = $${matchIdPlaceholder}
       AND id = $${highlightIdPlaceholder}
     RETURNING ${HIGHLIGHT_COLUMNS}`,
    values
  );

  if (!rows[0]) return { ok: false, code: 'HIGHLIGHT_NOT_FOUND' };
  return { ok: true, highlight: mapHighlight(rows[0]) };
}

async function deleteHighlight(rawMatchId, rawHighlightId) {
  const matchId = normalizePositiveInteger(rawMatchId);
  const highlightId = normalizePositiveInteger(rawHighlightId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };
  if (!highlightId) return { ok: false, code: 'INVALID_HIGHLIGHT_ID' };

  await ensureMatchMediaTables();
  const result = await db.query(
    'DELETE FROM match_highlights WHERE match_id = $1 AND id = $2',
    [matchId, highlightId]
  );
  return result.rowCount
    ? { ok: true }
    : { ok: false, code: 'HIGHLIGHT_NOT_FOUND' };
}

async function deleteAllHighlights(rawMatchId) {
  const matchId = normalizePositiveInteger(rawMatchId);
  if (!matchId) return { ok: false, code: 'INVALID_MATCH_ID' };

  await ensureMatchMediaTables();
  if (!(await matchExists(matchId))) {
    return { ok: false, code: 'MATCH_NOT_FOUND' };
  }

  const result = await db.query(
    'DELETE FROM match_highlights WHERE match_id = $1',
    [matchId]
  );
  return { ok: true, deletedCount: result.rowCount };
}

module.exports = {
  createHighlight,
  deleteAllHighlights,
  deleteHighlight,
  ensureMatchMediaTables,
  formatTimestamp,
  listHighlights,
  listVideoSources,
  replaceVideoSources,
  updateHighlight,
  validateHighlightPayload,
  validateVideoSourcesPayload,
};
