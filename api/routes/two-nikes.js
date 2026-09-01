const { db } = require('../db/config');

const TWO_NIKE_COLUMNS = `
  id,
  video_id,
  title,
  timestamp_seconds,
  created_by,
  created_at,
  updated_at
`;

let tableReadyPromise = null;

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

function mapTwoNike(row) {
  const timestampSeconds = Number(row.timestamp_seconds);

  return {
    id: Number(row.id),
    videoId: row.video_id,
    title: row.title,
    timestampSeconds,
    timestamp: formatTimestamp(timestampSeconds),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureTwoNikeTable() {
  if (tableReadyPromise) return tableReadyPromise;

  tableReadyPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS video_2nikes (
        id SERIAL PRIMARY KEY,
        video_id TEXT NOT NULL,
        title TEXT NOT NULL,
        timestamp_seconds INTEGER NOT NULL CHECK (
          timestamp_seconds >= 0 AND timestamp_seconds <= 86400
        ),
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS video_2nikes_timeline_idx
      ON video_2nikes (video_id, timestamp_seconds, id)
    `);

    await db.query(
      'ALTER TABLE video_2nikes ENABLE ROW LEVEL SECURITY'
    );

    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE video_2nikes FROM anon';
          EXECUTE 'REVOKE ALL PRIVILEGES ON SEQUENCE video_2nikes_id_seq FROM anon';
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
        ) THEN
          EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE video_2nikes FROM authenticated';
          EXECUTE 'REVOKE ALL PRIVILEGES ON SEQUENCE video_2nikes_id_seq FROM authenticated';
        END IF;
      END
      $$
    `);
  })().catch(error => {
    tableReadyPromise = null;
    throw error;
  });

  return tableReadyPromise;
}

async function listTwoNikesByVideoId(videoId) {
  await ensureTwoNikeTable();
  const { rows } = await db.query(
    `SELECT ${TWO_NIKE_COLUMNS}
     FROM video_2nikes
     WHERE video_id = $1
     ORDER BY timestamp_seconds, id`,
    [videoId]
  );

  return rows.map(mapTwoNike);
}

async function insertTwoNike({
  videoId,
  title,
  timestampSeconds,
  createdBy,
}) {
  await ensureTwoNikeTable();
  const { rows } = await db.query(
    `INSERT INTO video_2nikes
      (video_id, title, timestamp_seconds, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING ${TWO_NIKE_COLUMNS}`,
    [videoId, title, timestampSeconds, createdBy]
  );

  return mapTwoNike(rows[0]);
}

module.exports = {
  ensureTwoNikeTable,
  formatTimestamp,
  insertTwoNike,
  listTwoNikesByVideoId,
  mapTwoNike,
};
