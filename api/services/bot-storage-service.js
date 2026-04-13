const fs = require('fs');
const path = require('path');
const { db } = require('../db/config');

const BOT_STORAGE_FILE = path.resolve(
  process.cwd(),
  process.env.BOT_STATE_FILE ||
    path.join(__dirname, '../../.runtime/bot/storage.json')
);
const CURRENT_MATCH_ROW_ID = 1;

function createDefaultBotStorage() {
  return {
    bench: [],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
    tiensan: 0,
    tiennuoc: 0,
    teamThua: null,
    activeVote: null,
    lastUpdated: null,
  };
}

function getBotStorageFilePath() {
  return BOT_STORAGE_FILE;
}

function getCurrentVietnamTimestamp() {
  const vietnamOffset = 7 * 60;
  const localOffset = new Date().getTimezoneOffset();
  const now = new Date(Date.now() + (vietnamOffset + localOffset) * 60000);
  return now.toISOString().replace('Z', '+07:00');
}

function ensureStorageDirectory() {
  fs.mkdirSync(path.dirname(BOT_STORAGE_FILE), { recursive: true });
}

function readBotStorageFile() {
  if (!fs.existsSync(BOT_STORAGE_FILE)) {
    return createDefaultBotStorage();
  }

  const raw = fs.readFileSync(BOT_STORAGE_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeBotStorageFile(payload) {
  ensureStorageDirectory();
  const toSave = {
    ...createDefaultBotStorage(),
    ...payload,
    lastUpdated: getCurrentVietnamTimestamp(),
  };

  fs.writeFileSync(BOT_STORAGE_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  return toSave;
}

function resetBotStorageFile() {
  ensureStorageDirectory();
  const defaultStorage = createDefaultBotStorage();
  fs.writeFileSync(
    BOT_STORAGE_FILE,
    JSON.stringify(defaultStorage, null, 2),
    'utf8'
  );
  return defaultStorage;
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

async function readActiveVoteFromDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  await ensureCurrentMatchTable();
  const result = await db.query(
    'SELECT active_vote FROM current_match WHERE id = $1',
    [CURRENT_MATCH_ROW_ID]
  );

  return result.rows[0]?.active_vote ?? null;
}

async function writeActiveVoteToDb(activeVote) {
  if (!process.env.DATABASE_URL) {
    return;
  }

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

async function readBotStorage() {
  const storage = readBotStorageFile();

  try {
    const activeVote = await readActiveVoteFromDb();
    return {
      ...storage,
      activeVote,
    };
  } catch (error) {
    console.error('❌ Failed to load activeVote from current_match:', error);
    return storage;
  }
}

async function writeBotStorage(payload) {
  const toSave = writeBotStorageFile(payload);

  try {
    await writeActiveVoteToDb(toSave.activeVote ?? null);
  } catch (error) {
    console.error('❌ Failed to save activeVote to current_match:', error);
  }

  return toSave;
}

async function resetBotStorage() {
  const defaultStorage = resetBotStorageFile();

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
    const voteOption = voter.options[0];

    if (voteOption === 0) return;

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
  getBotStorageFilePath,
  ensureCurrentMatchTable,
  readBotStorage,
  writeBotStorage,
  resetBotStorage,
  syncBotStorageFromVote,
};
