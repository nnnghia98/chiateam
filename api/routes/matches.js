const { db } = require('../db/config');

/**
 * Low-level repository for matches, match_players, and match_player_stats.
 * Migrated from SQLite (sqlite3 callbacks) to PostgreSQL (pg async/await).
 */

/**
 * Get match by date (YYYY-MM-DD).
 */
async function getMatchByDate(matchDate) {
  const { rows } = await db.query('SELECT * FROM matches WHERE match_date = $1', [matchDate]);
  return rows[0] || null;
}

/**
 * Get match_player_stats for a match as map of playerId -> { goals, assists, is_mvp }.
 */
async function getMatchPlayerStats(matchId) {
  const { rows } = await db.query(
    'SELECT player_id, goals, assists, is_mvp FROM match_player_stats WHERE match_id = $1',
    [matchId]
  );
  const map = {};
  rows.forEach(r => {
    map[r.player_id] = { goals: r.goals, assists: r.assists, is_mvp: r.is_mvp };
  });
  return map;
}

/**
 * Get match with its players (joined with players table for name/number).
 */
async function getMatchWithPlayers(matchDate) {
  const match = await getMatchByDate(matchDate);
  if (!match) return null;

  const { rows } = await db.query(
    `SELECT mp.id, mp.player_id, mp.side, mp.display_name,
            p.name, p.number
     FROM match_players mp
     LEFT JOIN players p ON mp.player_id = p.id
     WHERE mp.match_id = $1
     ORDER BY mp.side, p.number`,
    [match.id]
  );

  const homePlayers = [];
  const awayPlayers = [];
  const extraPlayers = [];

  rows.forEach(row => {
    const item = {
      playerId: row.player_id,
      displayName: row.display_name,
      name: row.name,
      number: row.number,
      label: row.player_id
        ? `${row.name} - ${row.number}`
        : row.display_name || '?',
    };
    if (row.side === 'HOME') homePlayers.push(item);
    else if (row.side === 'AWAY') awayPlayers.push(item);
    else if (row.side === 'EXTRA') extraPlayers.push(item);
  });

  const statsMap = await getMatchPlayerStats(match.id);
  [...homePlayers, ...awayPlayers, ...extraPlayers].forEach(p => {
    if (p.playerId && statsMap[p.playerId]) {
      p.goals = statsMap[p.playerId].goals;
      p.assists = statsMap[p.playerId].assists;
      p.isMvp = statsMap[p.playerId].is_mvp;
    }
  });

  return { ...match, homePlayers, awayPlayers, extraPlayers };
}

/**
 * Create or update a match and its players.
 */
async function createOrUpdateMatch({ matchDate, san, tiensan, homePlayers, awayPlayers, extraPlayers = [] }) {
  const existing = await getMatchByDate(matchDate);

  let matchId;
  if (existing) {
    await db.query(
      'UPDATE matches SET san = $1, tiensan = $2, updated_at = NOW() WHERE match_date = $3',
      [san, tiensan, matchDate]
    );
    matchId = existing.id;
  } else {
    const { rows } = await db.query(
      'INSERT INTO matches (match_date, san, tiensan) VALUES ($1, $2, $3) RETURNING id',
      [matchDate, san, tiensan]
    );
    matchId = rows[0].id;
  }

  // Delete and reinsert match_players
  await db.query('DELETE FROM match_players WHERE match_id = $1', [matchId]);

  const allPlayers = [
    ...homePlayers.map(p => ({ ...p, side: 'HOME' })),
    ...awayPlayers.map(p => ({ ...p, side: 'AWAY' })),
    ...extraPlayers.map(p => ({ ...p, side: 'EXTRA' })),
  ];

  for (const p of allPlayers) {
    await db.query(
      'INSERT INTO match_players (match_id, player_id, side, display_name) VALUES ($1, $2, $3, $4)',
      [matchId, p.playerId || null, p.side, p.displayName || null]
    );
  }

  return getMatchWithPlayers(matchDate);
}

/**
 * List matches ordered by date descending.
 */
async function listMatches(limit = 10, offset = 0) {
  const { rows } = await db.query(
    'SELECT * FROM matches ORDER BY match_date DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows;
}

/**
 * Check if a player is in a match's lineup.
 */
async function isPlayerInMatch(matchId, playerId) {
  const { rows } = await db.query(
    'SELECT 1 FROM match_players WHERE match_id = $1 AND player_id = $2 LIMIT 1',
    [matchId, playerId]
  );
  return rows.length > 0;
}

/**
 * Add goal/assist delta to a player's stats. Creates row if not exists.
 */
async function addMatchPlayerStatDelta(matchId, playerId, stat, delta) {
  const goalsVal = stat === 'goals' ? delta : 0;
  const assistsVal = stat === 'assists' ? delta : 0;
  await db.query(
    `INSERT INTO match_player_stats (match_id, player_id, goals, assists, is_mvp)
     VALUES ($1, $2, $3, $4, 0)
     ON CONFLICT (match_id, player_id) DO UPDATE SET
       goals   = match_player_stats.goals + $3,
       assists = match_player_stats.assists + $4`,
    [matchId, playerId, goalsVal, assistsVal]
  );
  return getMatchPlayerStats(matchId);
}

/**
 * Set MVP for a match. Clears previous MVP and sets the given player.
 */
async function setMatchMvp(matchId, playerId) {
  await db.query('UPDATE match_player_stats SET is_mvp = 0 WHERE match_id = $1', [matchId]);
  await db.query(
    `INSERT INTO match_player_stats (match_id, player_id, goals, assists, is_mvp)
     VALUES ($1, $2, 0, 0, 1)
     ON CONFLICT (match_id, player_id) DO UPDATE SET is_mvp = 1`,
    [matchId, playerId]
  );
  return getMatchPlayerStats(matchId);
}

/**
 * Update match result (scores).
 */
async function updateMatchResult(matchDate, homeScore, awayScore) {
  const result = await db.query(
    'UPDATE matches SET home_score = $1, away_score = $2, updated_at = NOW() WHERE match_date = $3',
    [homeScore, awayScore, matchDate]
  );
  if (result.rowCount === 0) throw new Error('Match not found');
  return getMatchWithPlayers(matchDate);
}

/**
 * Delete a match by date. Cascades to match_players and match_player_stats.
 */
async function deleteMatchByDate(matchDate) {
  const result = await db.query('DELETE FROM matches WHERE match_date = $1', [matchDate]);
  return result.rowCount > 0;
}

async function createMatch({
  matchDate,
  san = null,
  tiensan = null,
  homeScore = null,
  awayScore = null,
  notes = null,
}) {
  const { rows } = await db.query(
    `INSERT INTO matches (match_date, san, tiensan, home_score, away_score, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [matchDate, san, tiensan, homeScore, awayScore, notes]
  );
  return rows[0];
}

async function updateMatchByDate(matchDate, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(updates, 'san')) {
    fields.push(`san = $${idx++}`);
    values.push(updates.san);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'tiensan')) {
    fields.push(`tiensan = $${idx++}`);
    values.push(updates.tiensan);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'homeScore')) {
    fields.push(`home_score = $${idx++}`);
    values.push(updates.homeScore);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'awayScore')) {
    fields.push(`away_score = $${idx++}`);
    values.push(updates.awayScore);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
    fields.push(`notes = $${idx++}`);
    values.push(updates.notes);
  }

  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  fields.push('updated_at = NOW()');
  values.push(matchDate);

  const { rows } = await db.query(
    `UPDATE matches SET ${fields.join(', ')} WHERE match_date = $${idx} RETURNING *`,
    values
  );

  return rows[0] || null;
}

module.exports = {
  getMatchByDate,
  isPlayerInMatch,
  getMatchWithPlayers,
  createOrUpdateMatch,
  createMatch,
  listMatches,
  updateMatchByDate,
  updateMatchResult,
  deleteMatchByDate,
  getMatchPlayerStats,
  addMatchPlayerStatDelta,
  setMatchMvp,
};
