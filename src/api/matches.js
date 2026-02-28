const { db } = require('../db/config');

/**
 * Low-level repository for matches, match_players, and match_player_stats.
 *
 * Table schema reference (see src/script/tables.sql):
 * - matches: id, match_date, san, tiensan, home_score, away_score, notes, created_at, updated_at
 * - match_players: id, match_id, player_id, side, display_name
 * - match_player_stats: id, match_id, player_id, goals, assists, is_mvp
 */

/**
 * Get match by date (YYYY-MM-DD).
 *
 * @param {string} matchDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>}
 */
function getMatchByDate(matchDate) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM matches WHERE match_date = ?';

    db.get(sql, [matchDate], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

/**
 * Get match with its players (joined with players table for name/number).
 *
 * @param {string} matchDate - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>} Match with homePlayers and awayPlayers arrays
 */
function getMatchWithPlayers(matchDate) {
  return new Promise((resolve, reject) => {
    getMatchByDate(matchDate).then(match => {
      if (!match) {
        resolve(null);
        return;
      }

      const sql = `
        SELECT mp.id, mp.player_id, mp.side, mp.display_name,
               p.name, p.number
        FROM match_players mp
        LEFT JOIN players p ON mp.player_id = p.id
        WHERE mp.match_id = ?
        ORDER BY mp.side, p.number
      `;

      db.all(sql, [match.id], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const homePlayers = [];
        const awayPlayers = [];

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

          if (row.side === 'HOME') {
            homePlayers.push(item);
          } else {
            awayPlayers.push(item);
          }
        });

        // Fetch match_player_stats
        getMatchPlayerStats(match.id).then(statsMap => {
          homePlayers.forEach(p => {
            if (p.playerId && statsMap[p.playerId]) {
              p.goals = statsMap[p.playerId].goals;
              p.assists = statsMap[p.playerId].assists;
              p.isMvp = statsMap[p.playerId].is_mvp;
            }
          });
          awayPlayers.forEach(p => {
            if (p.playerId && statsMap[p.playerId]) {
              p.goals = statsMap[p.playerId].goals;
              p.assists = statsMap[p.playerId].assists;
              p.isMvp = statsMap[p.playerId].is_mvp;
            }
          });
          resolve({
            ...match,
            homePlayers,
            awayPlayers,
          });
        }).catch(reject);
      });
    }).catch(reject);
  });
}

/**
 * Create or update a match and its players.
 *
 * @param {Object} params
 * @param {string} params.matchDate - YYYY-MM-DD
 * @param {string|null} params.san
 * @param {number|null} params.tiensan
 * @param {Array<{playerId: number|null, displayName: string}>} params.homePlayers
 * @param {Array<{playerId: number|null, displayName: string}>} params.awayPlayers
 * @returns {Promise<Object>} The match row
 */
function createOrUpdateMatch({ matchDate, san, tiensan, homePlayers, awayPlayers }) {
  return new Promise((resolve, reject) => {
    getMatchByDate(matchDate).then(existing => {
      const sql = existing
        ? `UPDATE matches SET san = ?, tiensan = ?, updated_at = CURRENT_TIMESTAMP WHERE match_date = ?`
        : `INSERT INTO matches (match_date, san, tiensan) VALUES (?, ?, ?)`;

      const args = existing
        ? [san, tiensan, matchDate]
        : [matchDate, san, tiensan];

      db.run(sql, args, function (err) {
        if (err) {
          reject(err);
          return;
        }

        const matchId = existing ? existing.id : this.lastID;

        // Delete existing match_players
        db.run('DELETE FROM match_players WHERE match_id = ?', [matchId], err2 => {
          if (err2) {
            reject(err2);
            return;
          }

          const insertPlayer = (playerId, side, displayName) => {
            return new Promise((res, rej) => {
              db.run(
                'INSERT INTO match_players (match_id, player_id, side, display_name) VALUES (?, ?, ?, ?)',
                [matchId, playerId, side, displayName || null],
                err3 => (err3 ? rej(err3) : res())
              );
            });
          };

          const inserts = [
            ...homePlayers.map(p => insertPlayer(p.playerId, 'HOME', p.displayName)),
            ...awayPlayers.map(p => insertPlayer(p.playerId, 'AWAY', p.displayName)),
          ];

          Promise.all(inserts)
            .then(() => getMatchWithPlayers(matchDate))
            .then(resolve)
            .catch(reject);
        });
      });
    }).catch(reject);
  });
}

/**
 * List matches ordered by date descending.
 *
 * @param {number} [limit=10]
 * @param {number} [offset=0]
 * @returns {Promise<Array>}
 */
function listMatches(limit = 10, offset = 0) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM matches ORDER BY match_date DESC LIMIT ? OFFSET ?';

    db.all(sql, [limit, offset], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * Check if a player is in a match's lineup.
 *
 * @param {number} matchId
 * @param {number} playerId
 * @returns {Promise<boolean>}
 */
function isPlayerInMatch(matchId, playerId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT 1 FROM match_players WHERE match_id = ? AND player_id = ? LIMIT 1';

    db.get(sql, [matchId, playerId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(!!row);
    });
  });
}

/**
 * Get match_player_stats for a match as map of playerId -> { goals, assists, is_mvp }.
 *
 * @param {number} matchId
 * @returns {Promise<Object>}
 */
function getMatchPlayerStats(matchId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT player_id, goals, assists, is_mvp FROM match_player_stats WHERE match_id = ?';

    db.all(sql, [matchId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const map = {};
      rows.forEach(r => {
        map[r.player_id] = { goals: r.goals, assists: r.assists, is_mvp: r.is_mvp };
      });
      resolve(map);
    });
  });
}

/**
 * Add goal/assist delta to a player's stats. Creates row if not exists.
 *
 * @param {number} matchId
 * @param {number} playerId
 * @param {string} stat - 'goals' or 'assists'
 * @param {number} delta
 * @returns {Promise<Object>} Stats map
 */
function addMatchPlayerStatDelta(matchId, playerId, stat, delta) {
  return new Promise((resolve, reject) => {
    const goalsVal = stat === 'goals' ? delta : 0;
    const assistsVal = stat === 'assists' ? delta : 0;
    const sql = `
      INSERT INTO match_player_stats (match_id, player_id, goals, assists, is_mvp)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(match_id, player_id) DO UPDATE SET
        goals = goals + excluded.goals,
        assists = assists + excluded.assists
    `;

    db.run(sql, [matchId, playerId, goalsVal, assistsVal], function (err) {
      if (err) {
        reject(err);
        return;
      }
      getMatchPlayerStats(matchId).then(resolve).catch(reject);
    });
  });
}

/**
 * Set MVP for a match. Clears previous MVP and sets the given player.
 *
 * @param {number} matchId
 * @param {number} playerId
 * @returns {Promise<Object>} Stats map
 */
function setMatchMvp(matchId, playerId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE match_player_stats SET is_mvp = 0 WHERE match_id = ?', [matchId], err => {
      if (err) {
        reject(err);
        return;
      }
      const sql = `
        INSERT INTO match_player_stats (match_id, player_id, goals, assists, is_mvp)
        VALUES (?, ?, 0, 0, 1)
        ON CONFLICT(match_id, player_id) DO UPDATE SET is_mvp = 1
      `;
      db.run(sql, [matchId, playerId], function (err2) {
        if (err2) {
          reject(err2);
          return;
        }
        getMatchPlayerStats(matchId).then(resolve).catch(reject);
      });
    });
  });
}

/**
 * Update match result (scores).
 *
 * @param {string} matchDate - YYYY-MM-DD
 * @param {number} homeScore
 * @param {number} awayScore
 * @returns {Promise<Object>} Updated match
 */
function updateMatchResult(matchDate, homeScore, awayScore) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE matches
      SET home_score = ?, away_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE match_date = ?
    `;

    db.run(sql, [homeScore, awayScore, matchDate], function (err) {
      if (err) {
        reject(err);
        return;
      }
      if (this.changes === 0) {
        reject(new Error('Match not found'));
        return;
      }
      getMatchWithPlayers(matchDate).then(resolve).catch(reject);
    });
  });
}

/**
 * Delete a match by date. Cascades to match_players and match_player_stats.
 *
 * @param {string} matchDate - YYYY-MM-DD
 * @returns {Promise<boolean>} True if a row was deleted
 */
function deleteMatchByDate(matchDate) {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM matches WHERE match_date = ?';

    db.run(sql, [matchDate], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });
  });
}

module.exports = {
  getMatchByDate,
  isPlayerInMatch,
  getMatchWithPlayers,
  createOrUpdateMatch,
  listMatches,
  updateMatchResult,
  deleteMatchByDate,
  getMatchPlayerStats,
  addMatchPlayerStatDelta,
  setMatchMvp,
};
