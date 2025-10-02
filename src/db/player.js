const { db } = require('./config');

/**
 * Add a new player to the player table
 * @param {number} teleId - Telegram user ID
 * @param {string} name - Player name
 * @param {number} number - Player number (optional)
 * @param {string} username - Telegram username (optional)
 * @returns {Promise<Object>} - Created player object
 */
function addPlayer(teleId, name, number = null, username = null) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO player (tele_id, name, number, username, goal, assist)
      VALUES (?, ?, ?, ?, 0, 0)
    `;

    db.run(sql, [teleId, name, number, username], function (err) {
      if (err) {
        reject(err);
        return;
      }

      // Get the created player
      getPlayerByTeleId(teleId).then(resolve).catch(reject);
    });
  });
}

/**
 * Get player by Telegram ID
 * @param {number} teleId - Telegram user ID
 * @returns {Promise<Object|null>} - Player object or null if not found
 */
function getPlayerByTeleId(teleId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM player WHERE tele_id = ?';

    db.get(sql, [teleId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

/**
 * Get player by ID
 * @param {number} id - Player ID
 * @returns {Promise<Object|null>} - Player object or null if not found
 */
function getPlayerById(id) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM player WHERE id = ?';

    db.get(sql, [id], (err, row) => {
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
    const sql = 'SELECT * FROM player ORDER BY name';

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
 * @param {number} teleId - Telegram user ID
 * @param {Object} updates - Object with fields to update
 * @returns {Promise<Object>} - Updated player object
 */
function updatePlayer(teleId, updates) {
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
    values.push(teleId);

    const sql = `UPDATE player SET ${updateFields.join(', ')} WHERE tele_id = ?`;

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
      getPlayerByTeleId(teleId).then(resolve).catch(reject);
    });
  });
}

/**
 * Update player goals and assists
 * @param {number} teleId - Telegram user ID
 * @param {number} goals - Goals to add (can be negative)
 * @param {number} assists - Assists to add (can be negative)
 * @returns {Promise<Object>} - Updated player object
 */
function updatePlayerStats(teleId, goals = 0, assists = 0) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE player 
      SET goal = goal + ?, assist = assist + ?, updated_at = CURRENT_TIMESTAMP
      WHERE tele_id = ?
    `;

    db.run(sql, [goals, assists, teleId], function (err) {
      if (err) {
        reject(err);
        return;
      }

      if (this.changes === 0) {
        reject(new Error('Player not found'));
        return;
      }

      // Get the updated player
      getPlayerByTeleId(teleId).then(resolve).catch(reject);
    });
  });
}

/**
 * Delete player by Telegram ID
 * @param {number} teleId - Telegram user ID
 * @returns {Promise<boolean>} - True if player was deleted
 */
function deletePlayer(teleId) {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM player WHERE tele_id = ?';

    db.run(sql, [teleId], function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this.changes > 0);
    });
  });
}

/**
 * Get player by number
 * @param {number} number - Player number
 * @returns {Promise<Object|null>} - Player object or null if not found
 */
function getPlayerByNumber(number) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM player WHERE number = ?';

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
 * Get players by number
 * @param {number} number - Player number
 * @returns {Promise<Array>} - Array of player with that number
 */
function getPlayersByNumber(number) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM player WHERE number = ? ORDER BY name';

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
      'SELECT * FROM player WHERE name LIKE ? OR username LIKE ? ORDER BY name';
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
  getPlayerByTeleId,
  getPlayerById,
  getAllPlayers,
  updatePlayer,
  updatePlayerStats,
  deletePlayer,
  getPlayerByNumber,
  getPlayersByNumber,
  searchPlayers,
};
