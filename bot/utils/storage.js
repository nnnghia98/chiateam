const {
  getApiBaseUrl,
  readBotStorage,
  writeBotStorage,
  resetBotStorage,
} = require('./api-client');

const DEFAULT_DATA = {
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

function cloneDefaultData() {
  return {
    ...DEFAULT_DATA,
    bench: [],
    teamA: [],
    teamB: [],
    team3A: [],
    team3B: [],
    team3C: [],
  };
}

function normalizeEntryArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(entry => Array.isArray(entry) && entry.length >= 2);
}

function mapToArray(map) {
  return Array.from(map.entries());
}

function arrayToMap(arr) {
  return new Map(normalizeEntryArray(arr));
}

function normalizeStorageData(data = {}) {
  return {
    ...cloneDefaultData(),
    ...data,
    bench: normalizeEntryArray(data.bench),
    teamA: normalizeEntryArray(data.teamA),
    teamB: normalizeEntryArray(data.teamB),
    team3A: normalizeEntryArray(data.team3A),
    team3B: normalizeEntryArray(data.team3B),
    team3C: normalizeEntryArray(data.team3C),
    tiensan: data.tiensan ?? 0,
    tiennuoc: data.tiennuoc ?? 0,
    teamThua: data.teamThua ?? null,
    activeVote: data.activeVote ?? null,
    lastUpdated: data.lastUpdated ?? null,
  };
}

async function loadData() {
  try {
    const data = await readBotStorage();
    const normalized = normalizeStorageData(data);

    console.log('✅ Loaded bot storage from API:', getApiBaseUrl());

    return normalized;
  } catch (error) {
    console.error('❌ Error loading bot storage from API:', error);
    console.warn('📝 Falling back to default bot storage state');
    return cloneDefaultData();
  }
}

function getVietnamTime() {
  const now = new Date();
  const vietnamOffset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const vietnamTime = new Date(
    now.getTime() + (vietnamOffset + localOffset) * 60000
  );

  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  const hours = String(vietnamTime.getHours()).padStart(2, '0');
  const minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
  const seconds = String(vietnamTime.getSeconds()).padStart(2, '0');
  const ms = String(vietnamTime.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+07:00`;
}

function buildStorageSnapshot(state) {
  return {
    bench: mapToArray(state.bench),
    teamA: mapToArray(state.teamA),
    teamB: mapToArray(state.teamB),
    team3A: mapToArray(state.team3A),
    team3B: mapToArray(state.team3B),
    team3C: mapToArray(state.team3C),
    tiensan: state.getTiensan(),
    tiennuoc: state.getTiennuoc(),
    teamThua: state.getTeamThua(),
    activeVote: state.getActiveVote(),
    lastUpdated: getVietnamTime(),
  };
}

async function saveData(state) {
  try {
    const saved = await writeBotStorage(buildStorageSnapshot(state));
    console.log('💾 Bot storage saved via API');
    return saved;
  } catch (error) {
    console.error('❌ Error saving bot storage via API:', error);
    return null;
  }
}

function createPersistentMap(map, saveCallback) {
  const originalSet = map.set.bind(map);
  const originalDelete = map.delete.bind(map);
  const originalClear = map.clear.bind(map);

  map.set = function (...args) {
    const result = originalSet(...args);
    void Promise.resolve(saveCallback()).catch(error => {
      console.error('❌ Error persisting bot storage map change:', error);
    });
    return result;
  };

  map.delete = function (...args) {
    const result = originalDelete(...args);
    void Promise.resolve(saveCallback()).catch(error => {
      console.error('❌ Error persisting bot storage map change:', error);
    });
    return result;
  };

  map.clear = function (...args) {
    const result = originalClear(...args);
    void Promise.resolve(saveCallback()).catch(error => {
      console.error('❌ Error persisting bot storage map change:', error);
    });
    return result;
  };

  return map;
}

function createStateFromData(data) {
  const bench = arrayToMap(data.bench);
  const teamA = arrayToMap(data.teamA);
  const teamB = arrayToMap(data.teamB);
  const team3A = arrayToMap(data.team3A);
  const team3B = arrayToMap(data.team3B);
  const team3C = arrayToMap(data.team3C);

  let tiensan = data.tiensan ?? 0;
  let tiennuoc = data.tiennuoc ?? 0;
  let teamThua = data.teamThua ?? null;
  let activeVote = data.activeVote ?? null;
  let lastUpdated = data.lastUpdated ?? null;
  let state = null;
  let saveQueue = Promise.resolve();
  const mapPrototype = Object.getPrototypeOf(bench);

  const replaceMapContents = (targetMap, entries) => {
    mapPrototype.clear.call(targetMap);
    normalizeEntryArray(entries).forEach(([key, value]) => {
      mapPrototype.set.call(targetMap, key, value);
    });
  };

  const applyStorageData = nextData => {
    replaceMapContents(bench, nextData.bench);
    replaceMapContents(teamA, nextData.teamA);
    replaceMapContents(teamB, nextData.teamB);
    replaceMapContents(team3A, nextData.team3A);
    replaceMapContents(team3B, nextData.team3B);
    replaceMapContents(team3C, nextData.team3C);
    tiensan = nextData.tiensan ?? 0;
    tiennuoc = nextData.tiennuoc ?? 0;
    teamThua = nextData.teamThua ?? null;
    activeVote = nextData.activeVote ?? null;
    lastUpdated = nextData.lastUpdated ?? null;
  };

  const persist = () => {
    saveQueue = saveQueue
      .then(() => saveData(state))
      .then(saved => {
        if (saved && saved.lastUpdated) {
          lastUpdated = saved.lastUpdated;
        }
      })
      .catch(error => {
        console.error('❌ Error persisting bot storage state:', error);
      });

    return saveQueue;
  };

  const resetPersist = () => {
    saveQueue = saveQueue
      .then(() => resetBotStorage())
      .then(saved => {
        if (saved && saved.lastUpdated) {
          lastUpdated = saved.lastUpdated;
        } else {
          lastUpdated = null;
        }
      })
      .catch(error => {
        console.error('❌ Error persisting bot storage reset:', error);
      });

    return saveQueue;
  };

  if (activeVote) {
    console.log(
      `📊 [storage] Loaded active vote: "${activeVote.question}" (${activeVote.totalVoters || 0} voters)`
    );
  }

  state = {
    bench,
    teamA,
    teamB,
    team3A,
    team3B,
    team3C,
    getTiensan: () => tiensan,
    setTiensan: val => {
      tiensan = val;
      return persist();
    },
    getTiennuoc: () => tiennuoc,
    setTiennuoc: val => {
      tiennuoc = val;
      return persist();
    },
    getLastUpdated: () => lastUpdated,
    getTeamThua: () => teamThua,
    setTeamThua: val => {
      teamThua = val;
      return persist();
    },
    getActiveVote: () => activeVote,
    setActiveVote: val => {
      activeVote = val;
      return persist();
    },
    refreshFromSource: () => {
      saveQueue = saveQueue.then(async () => {
        const nextData = await loadData();
        applyStorageData(nextData);
      });

      return saveQueue;
    },
    resetAll: () => {
      const originalBenchClear = Object.getPrototypeOf(bench).clear;
      const originalTeamAClear = Object.getPrototypeOf(teamA).clear;
      const originalTeamBClear = Object.getPrototypeOf(teamB).clear;
      const originalTeam3AClear = Object.getPrototypeOf(team3A).clear;
      const originalTeam3BClear = Object.getPrototypeOf(team3B).clear;
      const originalTeam3CClear = Object.getPrototypeOf(team3C).clear;

      originalBenchClear.call(bench);
      originalTeamAClear.call(teamA);
      originalTeamBClear.call(teamB);
      originalTeam3AClear.call(team3A);
      originalTeam3BClear.call(team3B);
      originalTeam3CClear.call(team3C);

      tiensan = 0;
      tiennuoc = 0;
      teamThua = null;
      activeVote = null;

      console.log('🔄 [storage] Reset all data to defaults');
      return resetPersist();
    },
    save: () => persist(),
  };

  createPersistentMap(bench, () => persist());
  createPersistentMap(teamA, () => persist());
  createPersistentMap(teamB, () => persist());
  createPersistentMap(team3A, () => persist());
  createPersistentMap(team3B, () => persist());
  createPersistentMap(team3C, () => persist());

  return state;
}

async function initializeStorage() {
  const data = await loadData();
  return createStateFromData(data);
}

module.exports = {
  initializeStorage,
  loadData,
  saveData,
  mapToArray,
  arrayToMap,
};
