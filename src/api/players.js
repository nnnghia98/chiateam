const { db } = require('../db/config');

/**
 * Low-level repository for the `players` table.
 * This module is intentionally focused on CRUD operations only.
 *
 * Table schema reference (see src/script/tables.sql):
 * CREATE TABLE players (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   user_id INTEGER NOT NULL UNIQUE,
 *   number INTEGER NOT NULL UNIQUE,
 *   name TEXT NOT NULL,
 *   username TEXT,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
 * );
 */

/**
 * Insert a new player row.
 * Domain validation (required fields, uniqueness) should be done in services.
 *
 * @param {Object} params
 * @param {number} params.userId
 * @param {string} params.name
 * @param {number} params.number
 * @param {string|null} [params.username]
 * @returns {Promise<Object>} Inserted player row
 */
function createPlayer({ userId, name, number, username = null }) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO players (user_id, name, number, username)
      VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [userId, name, number, username], function (err) {
      if (err) {
        reject(err);
        return;
      }

      getPlayerByUserId(userId).then(resolve).catch(reject);
    });
  });
}

/**
 * Get player by Telegram user_id.
 *
 * @param {number} userId
 * @returns {Promise<Object|null>}
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
 * Get player by shirt number.
 *
 * @param {number} number
 * @returns {Promise<Object|null>}
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
 * Get all players ordered by name.
 *
 * @returns {Promise<Array>}
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
 * Update player information by user_id.
 * Only allows updating a subset of columns.
 *
 * @param {number} userId
 * @param {Object} updates
 * @returns {Promise<Object>} Updated player row
 */
function updatePlayer(userId, updates) {
  return new Promise((resolve, reject) => {
    const allowedFields = ['name', 'number', 'username'];
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
 * Get all players that share the same shirt number.
 *
 * @param {number} number
 * @returns {Promise<Array>}
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
 * Search players by partial match on name or username.
 *
 * @param {string} searchTerm
 * @returns {Promise<Array>}
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
  createPlayer,
  getPlayerByUserId,
  getPlayerByNumber,
  getAllPlayers,
  updatePlayer,
  deletePlayer,
  getPlayersByNumber,
  searchPlayers,
};
