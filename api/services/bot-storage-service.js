const { db } = require('../db/config');
const {
  getSelectedVoteOption,
  isComingVoteOption,
} = require('../../shared/vote-options');

const CURRENT_MATCH_ROW_ID = 1;
const STORAGE_ROW_ID = 1;
const STORAGE_SELECT_COLUMNS = `
  bench,
  "teamA",
  "teamB",
  "team3A",
  "team3B",
  "team3C",
  manifest,
  san,
  tiensan,
  tiennuoc,
  "teamThua",
  "activeVote",
  "lastUpdated"
`;

function createDefaultBotStorage() {
  return {
    bench: [],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    manifest: null,
    san: null,
    tiensan: 0,
    tiennuoc: 0,
    teamThua: null,
    activeVote: null,
    lastUpdated: null,
  };
}

function getCurrentVietnamTimestamp() {
  const vietnamOffset = 7 * 60;
  const localOffset = new Date().getTimezoneOffset();
  const now = new Date(Date.now() + (vietnamOffset + localOffset) * 60000);
  return now.toISOString().replace('Z', '+07:00');
}

function buildStoragePayload(payload, { touch = true } = {}) {
  return {
    ...createDefaultBotStorage(),
    ...payload,
    lastUpdated: touch
      ? getCurrentVietnamTimestamp()
      : (payload?.lastUpdated ?? null),
  };
}

function serializeJsonColumn(value) {
  return value == null ? null : JSON.stringify(value);
}

function storageRowToPayload(row) {
  if (!row) {
    return null;
  }

  return {
    ...createDefaultBotStorage(),
    bench: row.bench ?? [],
    teamA: row.teamA ?? [],
    teamB: row.teamB ?? [],
    team3A: row.team3A ?? [],
    team3B: row.team3B ?? [],
    team3C: row.team3C ?? [],
    manifest: row.manifest ?? null,
    san: row.san ?? null,
    tiensan: row.tiensan ?? 0,
    tiennuoc: row.tiennuoc ?? 0,
    teamThua: row.teamThua ?? null,
    activeVote: row.activeVote ?? null,
    lastUpdated: row.lastUpdated ?? null,
  };
}

async function ensureStorageTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS storage (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      bench JSONB,
      "teamA" JSONB,
      "teamB" JSONB,
      "team3A" JSONB,
      "team3B" JSONB,
      "team3C" JSONB,
      manifest JSONB,
      san TEXT,
      tiensan INTEGER,
      tiennuoc INTEGER,
      "teamThua" TEXT,
      "activeVote" JSONB,
      "lastUpdated" TEXT
    )
  `);

  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS bench JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS "teamA" JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS "teamB" JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS "team3A" JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS "team3B" JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS "team3C" JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS manifest JSONB');
  await db.query('ALTER TABLE storage ADD COLUMN IF NOT EXISTS san TEXT');
  await db.query(
    'ALTER TABLE storage ADD COLUMN IF NOT EXISTS tiensan INTEGER'
  );
  await db.query(
    'ALTER TABLE storage ADD COLUMN IF NOT EXISTS tiennuoc INTEGER'
  );
  await db.query(
    'ALTER TABLE storage ADD COLUMN IF NOT EXISTS "teamThua" TEXT'
  );
  await db.query(
    'ALTER TABLE storage ADD COLUMN IF NOT EXISTS "activeVote" JSONB'
  );
  await db.query(
    'ALTER TABLE storage ADD COLUMN IF NOT EXISTS "lastUpdated" TEXT'
  );
}

async function readBotStorageFromDb() {
  await ensureStorageTable();
  const result = await db.query(
    `
      SELECT ${STORAGE_SELECT_COLUMNS}
      FROM storage
      WHERE id = $1
    `,
    [STORAGE_ROW_ID]
  );

  return storageRowToPayload(result.rows[0]);
}

async function writeBotStorageToDb(storage) {
  await ensureStorageTable();
  const result = await db.query(
    `
      INSERT INTO storage (
        id,
        bench,
        "teamA",
        "teamB",
        "team3A",
        "team3B",
        "team3C",
        manifest,
        san,
        tiensan,
        tiennuoc,
        "teamThua",
        "activeVote",
        "lastUpdated"
      )
      VALUES (
        $1,
        $2::jsonb,
        $3::jsonb,
        $4::jsonb,
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        $14
      )
      ON CONFLICT (id)
      DO UPDATE SET
        bench = EXCLUDED.bench,
        "teamA" = EXCLUDED."teamA",
        "teamB" = EXCLUDED."teamB",
        "team3A" = EXCLUDED."team3A",
        "team3B" = EXCLUDED."team3B",
        "team3C" = EXCLUDED."team3C",
        manifest = EXCLUDED.manifest,
        san = EXCLUDED.san,
        tiensan = EXCLUDED.tiensan,
        tiennuoc = EXCLUDED.tiennuoc,
        "teamThua" = EXCLUDED."teamThua",
        "activeVote" = EXCLUDED."activeVote",
        "lastUpdated" = EXCLUDED."lastUpdated"
      RETURNING ${STORAGE_SELECT_COLUMNS}
    `,
    [
      STORAGE_ROW_ID,
      serializeJsonColumn(storage.bench),
      serializeJsonColumn(storage.teamA),
      serializeJsonColumn(storage.teamB),
      serializeJsonColumn(storage.team3A),
      serializeJsonColumn(storage.team3B),
      serializeJsonColumn(storage.team3C),
      serializeJsonColumn(storage.manifest),
      storage.san ?? null,
      storage.tiensan ?? null,
      storage.tiennuoc ?? null,
      storage.teamThua ?? null,
      serializeJsonColumn(storage.activeVote),
      storage.lastUpdated ?? null,
    ]
  );

  return storageRowToPayload(result.rows[0]);
}

async function ensureCurrentMatchTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS current_match (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      active_vote JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function writeActiveVoteToDb(activeVote) {
  await ensureCurrentMatchTable();
  await db.query(
    `
      INSERT INTO current_match (id, active_vote, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        active_vote = EXCLUDED.active_vote,
        updated_at = NOW()
    `,
    [CURRENT_MATCH_ROW_ID, JSON.stringify(activeVote)]
  );
}

function requireStorageDatabase() {
  if (!process.env.DATABASE_URL?.trim()) {
    const error = new Error('DATABASE_URL is required for bot storage');
    error.code = 'DATABASE_NOT_CONFIGURED';
    console.error('[storage]', error.message);
    throw error;
  }
}

async function readBotStorage() {
  requireStorageDatabase();
  return (await readBotStorageFromDb()) ?? createDefaultBotStorage();
}

async function writeBotStorage(payload) {
  requireStorageDatabase();
  const toSave = buildStoragePayload(payload);
  await writeBotStorageToDb(toSave);
  try {
    await writeActiveVoteToDb(toSave.activeVote ?? null);
  } catch (error) {
    console.error('❌ Failed to save activeVote to current_match:', error);
  }
  return toSave;
}

async function resetBotStorage() {
  requireStorageDatabase();
  const defaultStorage = createDefaultBotStorage();
  await writeBotStorageToDb(defaultStorage);
  try {
    await writeActiveVoteToDb(null);
  } catch (error) {
    console.error('❌ Failed to clear activeVote in current_match:', error);
  }
  return defaultStorage;
}

async function syncBotStorageFromVote() {
  const storage = await readBotStorage();
  const activeVote = storage.activeVote;

  if (!activeVote) {
    return {
      ok: false,
      statusCode: 400,
      body: { error: 'NO_ACTIVE_VOTE' },
    };
  }

  const benchMap = new Map(storage.bench || []);
  const voters = Object.values(activeVote.votes || {});
  let addedCount = 0;
  let skippedCount = 0;
  const addedNames = [];
  const skippedNames = [];

  voters.forEach(voter => {
    const userId = voter.id;
    const userName = voter.name;
    const voteOption = getSelectedVoteOption(voter);

    if (!isComingVoteOption(voteOption)) return;

    if (benchMap.has(userId)) {
      skippedCount++;
      skippedNames.push(userName);
    } else {
      benchMap.set(userId, { name: userName, userId });
      addedCount++;
      addedNames.push(userName);
    }

    if (voteOption >= 2) {
      const friendsCount = voteOption - 1;
      for (let i = 1; i <= friendsCount; i++) {
        const friendName = `${userName} ${i}`;
        const friendId = `${userId}_friend_${i}`;
        if (benchMap.has(friendId)) {
          skippedCount++;
          skippedNames.push(friendName);
        } else {
          benchMap.set(friendId, { name: friendName });
          addedCount++;
          addedNames.push(friendName);
        }
      }
    }
  });

  storage.bench = Array.from(benchMap.entries());
  storage.lastUpdated = getCurrentVietnamTimestamp();
  await writeBotStorage(storage);

  return {
    ok: true,
    statusCode: 200,
    body: {
      ok: true,
      addedCount,
      skippedCount,
      addedNames,
      skippedNames,
      storage,
    },
  };
}

module.exports = {
  createDefaultBotStorage,
  ensureStorageTable,
  ensureCurrentMatchTable,
  readBotStorage,
  writeBotStorage,
  resetBotStorage,
  syncBotStorageFromVote,
};
