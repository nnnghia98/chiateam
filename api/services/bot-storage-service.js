const fs = require('fs');
const path = require('path');

const BOT_STORAGE_FILE = path.resolve(
  process.cwd(),
  process.env.BOT_STATE_FILE ||
    path.join(__dirname, '../../.runtime/bot/storage.json')
);

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

function readBotStorage() {
  if (!fs.existsSync(BOT_STORAGE_FILE)) {
    return createDefaultBotStorage();
  }

  const raw = fs.readFileSync(BOT_STORAGE_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeBotStorage(payload) {
  ensureStorageDirectory();
  const toSave = {
    ...createDefaultBotStorage(),
    ...payload,
    lastUpdated: getCurrentVietnamTimestamp(),
  };

  fs.writeFileSync(BOT_STORAGE_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  return toSave;
}

function resetBotStorage() {
  ensureStorageDirectory();
  const defaultStorage = createDefaultBotStorage();
  fs.writeFileSync(
    BOT_STORAGE_FILE,
    JSON.stringify(defaultStorage, null, 2),
    'utf8'
  );
  return defaultStorage;
}

function syncBotStorageFromVote() {
  if (!fs.existsSync(BOT_STORAGE_FILE)) {
    return {
      ok: false,
      statusCode: 404,
      body: { error: 'No storage file found' },
    };
  }

  const storage = JSON.parse(fs.readFileSync(BOT_STORAGE_FILE, 'utf8'));
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

  fs.writeFileSync(BOT_STORAGE_FILE, JSON.stringify(storage, null, 2), 'utf8');

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
  readBotStorage,
  writeBotStorage,
  resetBotStorage,
  syncBotStorageFromVote,
};
