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
 * Get the next placeholder user_id (negative integer) for admin-created players.
 * Used so a real user can later "claim" the slot with /register NUMBER.
 * @returns {Promise<number>}
 */
function getNextPlaceholderUserId() {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT MIN(user_id) AS min_id FROM players WHERE user_id < 0';
    db.get(sql, [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      const next = row?.min_id != null ? row.min_id - 1 : -1;
      resolve(next);
    });
  });
}

/**
 * Create a player slot with a placeholder user_id (admin register for another).
 * The slot can be claimed later when someone runs /register NUMBER.
 *
 * @param {string} name
 * @param {number} number
 * @returns {Promise<Object>} Inserted player row
 */
async function createPlayerWithPlaceholder(name, number) {
  const placeholderId = await getNextPlaceholderUserId();
  return createPlayer({
    userId: placeholderId,
    name,
    number,
    username: null,
  });
}

/**
 * Update player by shirt number (e.g. when claiming an admin-created slot).
 *
 * @param {number} number
 * @param {Object} updates - { userId, name, username }
 * @returns {Promise<Object>} Updated player row
 */
function updatePlayerByNumber(number, updates) {
  return new Promise((resolve, reject) => {
    const allowed = ['userId', 'name', 'username'];
    const setClauses = [];
    const values = [];
    if (updates.userId != null) {
      setClauses.push('user_id = ?');
      values.push(updates.userId);
    }
    if (updates.name != null) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.username != null) {
      setClauses.push('username = ?');
      values.push(updates.username);
    }
    if (setClauses.length === 0) {
      reject(new Error('No valid fields to update'));
      return;
    }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(number);
    const sql = `UPDATE players SET ${setClauses.join(', ')} WHERE number = ?`;
    db.run(sql, values, function (err) {
      if (err) {
        reject(err);
        return;
      }
      if (this.changes === 0) {
        reject(new Error('Player not found'));
        return;
      }
      getPlayerByNumber(number).then(resolve).catch(reject);
    });
  });
}

/**
 * Delete player by shirt number. Also removes their leaderboard row if any.
 *
 * @param {number} number
 * @returns {Promise<boolean>} True if a player was deleted
 */
function deletePlayerByNumber(number) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM leaderboard WHERE player_number = ?', [number], (err) => {
      if (err) {
        reject(err);
        return;
      }
      db.run('DELETE FROM players WHERE number = ?', [number], function (err2) {
        if (err2) {
          reject(err2);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  });
}

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
      resolve(row ?? null);
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
  createPlayerWithPlaceholder,
  getPlayerByUserId,
  getPlayerByNumber,
  getAllPlayers,
  updatePlayer,
  updatePlayerByNumber,
  deletePlayer,
  deletePlayerByNumber,
  getPlayersByNumber,
  searchPlayers,
};
