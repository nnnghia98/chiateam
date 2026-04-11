const { db } = require('../db/config');

/**
 * Low-level repository for the `players` table.
 * Migrated from SQLite (sqlite3 callbacks) to PostgreSQL (pg async/await).
 *
 * Table schema (Supabase):
 * CREATE TABLE players (
 *   id         SERIAL PRIMARY KEY,
 *   user_id    BIGINT NOT NULL UNIQUE,
 *   number     INTEGER NOT NULL,
 *   name       TEXT NOT NULL,
 *   username   TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

/**
 * Get the next placeholder user_id (negative integer) for admin-created players.
 * @returns {Promise<number>}
 */
async function getNextPlaceholderUserId() {
  const { rows } = await db.query('SELECT MIN(user_id) AS min_id FROM players WHERE user_id < 0');
  const next = rows[0]?.min_id != null ? rows[0].min_id - 1 : -1;
  return next;
}

/**
 * Create a player slot with a placeholder user_id (admin register for another).
 */
async function createPlayerWithPlaceholder(name, number) {
  const placeholderId = await getNextPlaceholderUserId();
  return createPlayer({ userId: placeholderId, name, number, username: null });
}

/**
 * Update player by shirt number.
 */
async function updatePlayerByNumber(number, updates) {
  const setClauses = [];
  const values = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(updates, 'userId')) {
    setClauses.push(`user_id = $${idx++}`);
    values.push(updates.userId);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    setClauses.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'username')) {
    setClauses.push(`username = $${idx++}`);
    values.push(updates.username);
  }

  if (setClauses.length === 0) throw new Error('No valid fields to update');

  setClauses.push('updated_at = NOW()');
  values.push(number);

  const sql = `UPDATE players SET ${setClauses.join(', ')} WHERE number = $${idx}`;
  const result = await db.query(sql, values);
  if (result.rowCount === 0) throw new Error('Player not found');
  return getPlayerByNumber(number);
}

/**
 * Delete player by shirt number. Also removes their leaderboard row.
 */
async function deletePlayerByNumber(number) {
  await db.query('DELETE FROM leaderboard WHERE player_number = $1', [number]);
  const result = await db.query('DELETE FROM players WHERE number = $1', [number]);
  return result.rowCount > 0;
}

/**
 * Insert a new player row.
 */
async function createPlayer({ userId, name, number, username = null }) {
  const sql = `
    INSERT INTO players (user_id, name, number, username)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const { rows } = await db.query(sql, [userId, name, number, username]);
  return rows[0];
}

/**
 * Get player by Telegram user_id.
 */
async function getPlayerByUserId(userId) {
  const { rows } = await db.query('SELECT * FROM players WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

/**
 * Get player by shirt number.
 */
async function getPlayerByNumber(number) {
  const { rows } = await db.query('SELECT * FROM players WHERE number = $1', [number]);
  return rows[0] || null;
}

/**
 * Get all players ordered by name.
 */
async function getAllPlayers() {
  const { rows } = await db.query('SELECT * FROM players ORDER BY name');
  return rows;
}

/**
 * Update player information by user_id.
 */
async function updatePlayer(userId, updates) {
  const allowedFields = ['name', 'number', 'username'];
  const updateFields = [];
  const values = [];
  let idx = 1;

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = $${idx++}`);
      values.push(updates[key]);
    }
  });

  if (updateFields.length === 0) throw new Error('No valid fields to update');

  updateFields.push('updated_at = NOW()');
  values.push(userId);

  const sql = `UPDATE players SET ${updateFields.join(', ')} WHERE user_id = $${idx}`;
  const result = await db.query(sql, values);
  if (result.rowCount === 0) throw new Error('Player not found');
  return getPlayerByUserId(userId);
}

/**
 * Delete player by Telegram ID.
 */
async function deletePlayer(userId) {
  const result = await db.query('DELETE FROM players WHERE user_id = $1', [userId]);
  return result.rowCount > 0;
}

/**
 * Get all players that share the same shirt number.
 */
async function getPlayersByNumber(number) {
  const { rows } = await db.query('SELECT * FROM players WHERE number = $1 ORDER BY name', [number]);
  return rows;
}

/**
 * Search players by partial match on name or username.
 */
async function searchPlayers(searchTerm) {
  const pattern = `%${searchTerm}%`;
  const { rows } = await db.query('SELECT * FROM players WHERE name ILIKE $1 OR username ILIKE $2 ORDER BY name',
    [pattern, pattern]
  );
  return rows;
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
