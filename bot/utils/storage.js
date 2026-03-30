const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '../storage.json');

/**
 * Default data structure for bot state
 */
const DEFAULT_DATA = {
  bench: [],
  teamA: [],
  teamB: [],
  team3A: [],
  team3B: [],
  team3C: [],
  tiensan: 580000,
  tiennuoc: 60000,
  teamThua: null,
  activeVote: null,
  lastUpdated: null,
};

/**
 * Load data from JSON file
 * @returns {Object} The loaded data or default data if file doesn't exist
 */
function loadData() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const rawData = fs.readFileSync(STORAGE_FILE, 'utf8');
      const data = JSON.parse(rawData);
      console.log('✅ Loaded data from storage:', STORAGE_FILE);
      return data;
    }
  } catch (error) {
    console.error('❌ Error loading data from storage:', error);
  }

  console.log('📝 Using default data (no storage file found)');
  return { ...DEFAULT_DATA };
}

/**
 * Get current time in Vietnam timezone (GMT+7)
 * @returns {string} ISO string with Vietnam timezone offset
 */
function getVietnamTime() {
  const now = new Date();
  const vietnamOffset = 7 * 60; // GMT+7 in minutes
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

/**
 * Save data to JSON file
 * @param {Object} data - The data to save
 */
function saveData(data) {
  try {
    const dataToSave = {
      ...data,
      lastUpdated: getVietnamTime(),
    };

    fs.writeFileSync(STORAGE_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log('💾 Data saved to storage');
  } catch (error) {
    console.error('❌ Error saving data to storage:', error);
  }
}

/**
 * Convert Map to array for JSON serialization
 * @param {Map} map - The Map to convert
 * @returns {Array} Array of [key, value] pairs
 */
function mapToArray(map) {
  return Array.from(map.entries());
}

/**
 * Convert array back to Map
 * @param {Array} arr - Array of [key, value] pairs
 * @returns {Map} The reconstructed Map
 */
function arrayToMap(arr) {
  return new Map(arr);
}

/**
 * Create a persistent Map that auto-saves on changes
 * @param {Map} map - The Map to make persistent
 * @param {string} key - The key in storage for this Map
 * @param {Function} saveCallback - Function to call to trigger save
 * @returns {Map} A proxied Map that saves on changes
 */
function createPersistentMap(map, key, saveCallback) {
  // Wrap common Map methods to trigger save after modification
  const originalSet = map.set.bind(map);
  const originalDelete = map.delete.bind(map);
  const originalClear = map.clear.bind(map);

  map.set = function (...args) {
    const result = originalSet(...args);
    saveCallback();
    return result;
  };

  map.delete = function (...args) {
    const result = originalDelete(...args);
    saveCallback();
    return result;
  };

  map.clear = function (...args) {
    const result = originalClear(...args);
    saveCallback();
    return result;
  };

  return map;
}

/**
 * Initialize storage and return state objects
 * @returns {Object} Object containing all state maps and variables
 */
function initializeStorage() {
  const data = loadData();

  // Convert arrays back to Maps
  const bench = arrayToMap(data.bench || []);
  const teamA = arrayToMap(data.teamA || []);
  const teamB = arrayToMap(data.teamB || []);
  const team3A = arrayToMap(data.team3A || []);
  const team3B = arrayToMap(data.team3B || []);
  const team3C = arrayToMap(data.team3C || []);

  let tiensan = data.tiensan || 580000;
  let tiennuoc = data.tiennuoc || 60000;
  let teamThua = data.teamThua || null;
  let activeVote = data.activeVote || null;

  // Log if there's an active vote loaded
  if (activeVote) {
    console.log(
      `📊 [storage] Loaded active vote: "${activeVote.question}" (${activeVote.totalVoters || 0} voters)`
    );
  }

  // Save function that serializes current state
  const save = () => {
    saveData({
      bench: mapToArray(bench),
      teamA: mapToArray(teamA),
      teamB: mapToArray(teamB),
      team3A: mapToArray(team3A),
      team3B: mapToArray(team3B),
      team3C: mapToArray(team3C),
      tiensan,
      tiennuoc,
      teamThua,
      activeVote,
    });
  };

  // Make Maps auto-save on changes
  createPersistentMap(bench, 'bench', save);
  createPersistentMap(teamA, 'teamA', save);
  createPersistentMap(teamB, 'teamB', save);
  createPersistentMap(team3A, 'team3A', save);
  createPersistentMap(team3B, 'team3B', save);
  createPersistentMap(team3C, 'team3C', save);

  // Reset all data to defaults (batch operation - saves only once)
  const resetAll = () => {
    // Use original Map.clear() to avoid triggering individual saves
    const originalBenchClear = Object.getPrototypeOf(bench).clear;
    const originalTeamAClear = Object.getPrototypeOf(teamA).clear;
    const originalTeamBClear = Object.getPrototypeOf(teamB).clear;
    const originalTeam3AClear = Object.getPrototypeOf(team3A).clear;
    const originalTeam3BClear = Object.getPrototypeOf(team3B).clear;
    const originalTeam3CClear = Object.getPrototypeOf(team3C).clear;

    // Clear all maps without triggering saves
    originalBenchClear.call(bench);
    originalTeamAClear.call(teamA);
    originalTeamBClear.call(teamB);
    originalTeam3AClear.call(team3A);
    originalTeam3BClear.call(team3B);
    originalTeam3CClear.call(team3C);

    // Reset all values
    tiensan = 580000;
    tiennuoc = 60000;
    teamThua = null;
    activeVote = null;

    // Save once at the end
    save();
    console.log('🔄 [storage] Reset all data to defaults');
  };

  return {
    bench,
    teamA,
    teamB,
    team3A,
    team3B,
    team3C,
    getTiensan: () => tiensan,
    setTiensan: val => {
      tiensan = val;
      save();
    },
    getTiennuoc: () => tiennuoc,
    setTiennuoc: val => {
      tiennuoc = val;
      save();
    },
    getTeamThua: () => teamThua,
    setTeamThua: val => {
      teamThua = val;
      save();
    },
    getActiveVote: () => activeVote,
    setActiveVote: val => {
      activeVote = val;
      save();
    },
    resetAll, // Batch reset function
    save, // Manual save function if needed
  };
}

module.exports = {
  initializeStorage,
  loadData,
  saveData,
  mapToArray,
  arrayToMap,
};
