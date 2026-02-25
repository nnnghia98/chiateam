const { db } = require('./config');

/**
 * Add a new player to the player table
 * @param {number} userId - Telegram user ID
 * @param {string} name - Player name
 * @param {number} number - Player number
 * @param {string} username - Telegram username (optional)
 * @returns {Promise<Object>} - Created player object
 */
function addPlayer({ userId, name, number, username = null }) {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!name) {
      reject(new Error('Tên là bắt buộc'));
      return;
    }

    if (!number) {
      reject(new Error('Số áo là bắt buộc'));
      return;
    }

    const sql = `
      INSERT INTO players (user_id, name, number, username)
      VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [userId, name, number, username], function (err) {
      if (err) {
        reject(err);
        return;
      }

      // Get the created player
      getPlayerByUserId(userId).then(resolve).catch(reject);
    });
  });
}

/**
 * Get player by Telegram ID
 * @param {number} userId - Telegram user ID
 * @returns {Promise<Object|null>} - Player object or null if not found
 */
function getPlayerByUserId(userId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM players WHERE user_id = ?';

    db.get(sql, [userId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

/**
 * Get player by number (số áo)
 * @param {number} number - Player number (số áo)
 * @returns {Promise<Object|null>} - Player object or null if not found
 */
function getPlayerByNumber(number) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM players WHERE number = ?';

    db.get(sql, [number], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

/**
 * Get all player
 * @returns {Promise<Array>} - Array of all player
 */
function getAllPlayers() {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM players ORDER BY name';

    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * Update player information
 * @param {number} userId - Telegram user ID
 * @param {Object} updates - Object with fields to update
 * @returns {Promise<Object>} - Updated player object
 */
function updatePlayer(userId, updates) {
  return new Promise((resolve, reject) => {
    const allowedFields = ['name', 'number', 'username', 'goal', 'assist'];
    const updateFields = [];
    const values = [];

    // Build update query dynamically
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      reject(new Error('No valid fields to update'));
      return;
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const sql = `UPDATE players SET ${updateFields.join(', ')} WHERE user_id = ?`;

    db.run(sql, values, function (err) {
      if (err) {
        reject(err);
        return;
      }

      if (this.changes === 0) {
        reject(new Error('Player not found'));
        return;
      }

      // Get the updated player
      getPlayerByUserId(userId).then(resolve).catch(reject);
    });
  });
}

/**
 * Update player goals and assists
 * @param {number} userId - Telegram user ID
 * @param {number} goals - Goals to add (can be negative)
 * @param {number} assists - Assists to add (can be negative)
 * @returns {Promise<Object>} - Updated player object
 */
function updatePlayerStats(userId, goals = 0, assists = 0) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE players 
      SET goal = goal + ?, assist = assist + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;

    db.run(sql, [goals, assists, userId], function (err) {
      if (err) {
        reject(err);
        return;
      }

      if (this.changes === 0) {
        reject(new Error('Player not found'));
        return;
      }

      // Get the updated player
      getPlayerByUserId(userId).then(resolve).catch(reject);
    });
  });
}

/**
 * Delete player by Telegram ID
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>} - True if player was deleted
 */
function deletePlayer(userId) {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM players WHERE user_id = ?';

    db.run(sql, [userId], function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this.changes > 0);
    });
  });
}

/**
 * Get players by number
 * @param {number} number - Player number
 * @returns {Promise<Array>} - Array of player with that number
 */
function getPlayersByNumber(number) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM players WHERE number = ? ORDER BY name';

    db.all(sql, [number], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * Search player by name (partial match)
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} - Array of matching player
 */
function searchPlayers(searchTerm) {
  return new Promise((resolve, reject) => {
    const sql =
      'SELECT * FROM players WHERE name LIKE ? OR username LIKE ? ORDER BY name';
    const searchPattern = `%${searchTerm}%`;

    db.all(sql, [searchPattern, searchPattern], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

module.exports = {
  addPlayer,
  getPlayerByUserId,
  getPlayerByNumber,
  getAllPlayers,
  updatePlayer,
  updatePlayerStats,
  deletePlayer,
  getPlayersByNumber,
  searchPlayers,
};
