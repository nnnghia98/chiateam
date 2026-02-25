const { db } = require('../db/config');

/**
 * Low-level repository for the `leaderboard` table.
 * This module is intentionally focused on CRUD and batch operations only.
 *
 * Table schema reference (see src/script/tables.sql):
 * CREATE TABLE leaderboard (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   player_number INTEGER NOT NULL UNIQUE,
 *   winrate REAL DEFAULT 0.0,
 *   goal INTEGER DEFAULT 0,
 *   assist INTEGER DEFAULT 0,
 *   total_match INTEGER DEFAULT 0,
 *   total_win INTEGER DEFAULT 0,
 *   total_lose INTEGER DEFAULT 0,
 *   total_draw INTEGER DEFAULT 0,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
 * );
 */

/**
 * Get all leaderboard rows ordered by winrate and volume.
 *
 * @returns {Promise<Array>}
 */
async function findLeaderboardOrdered() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT player_number,
             total_match,
             total_win,
             total_lose,
             total_draw,
             goal,
             assist,
             winrate
      FROM leaderboard
      ORDER BY winrate DESC, total_match DESC, total_win DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Batch update player statistics for a match result (WIN/LOSE/DRAW).
 * This keeps the existing optimized SQL/transaction semantics.
 *
 * @param {Array<number>} playerNumbers
 * @param {'WIN'|'LOSE'|'DRAW'} result
 * @returns {Promise<void>}
 */
async function applyMatchResultBatch(playerNumbers, result) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const isWin = result === 'WIN';
      const isDraw = result === 'DRAW';
      const winIncrement = isWin ? 1 : 0;
      const loseIncrement = isWin ? 0 : 1;
      const drawIncrement = isDraw ? 1 : 0;

      const updateSQL = `
        INSERT OR REPLACE INTO leaderboard (
          player_number,
          total_match,
          total_win,
          total_lose,
          total_draw,
          goal,
          assist,
          winrate
        ) 
        VALUES (
          ?, 
          COALESCE((SELECT total_match FROM leaderboard WHERE player_number = ?), 0) + 1,
          COALESCE((SELECT total_win FROM leaderboard WHERE player_number = ?), 0) + ?,
          COALESCE((SELECT total_lose FROM leaderboard WHERE player_number = ?), 0) + ?,
          COALESCE((SELECT total_draw FROM leaderboard WHERE player_number = ?), 0) + ?,
          0,
          0,
          CASE 
            WHEN (COALESCE((SELECT total_win FROM leaderboard WHERE player_number = ?), 0) + ?) + 
                 (COALESCE((SELECT total_lose FROM leaderboard WHERE player_number = ?), 0) + ?) > 0 
            THEN ROUND(
              CAST((COALESCE((SELECT total_win FROM leaderboard WHERE player_number = ?), 0) + ?) AS REAL) / 
              CAST((COALESCE((SELECT total_win FROM leaderboard WHERE player_number = ?), 0) + ?) + 
                   (COALESCE((SELECT total_lose FROM leaderboard WHERE player_number = ?), 0) + ?) AS REAL),
              3
            )
            ELSE 0.0
          END
        )
      `;

      const stmt = db.prepare(updateSQL);
      let completedCount = 0;
      let hasError = false;

      playerNumbers.forEach((playerNumber, index) => {
        stmt.run(
          [
            playerNumber,
            playerNumber,
            playerNumber,
            winIncrement,
            playerNumber,
            loseIncrement,
            playerNumber,
            drawIncrement,
            playerNumber,
            winIncrement,
            playerNumber,
            loseIncrement,
            playerNumber,
            winIncrement,
            playerNumber,
            winIncrement,
            playerNumber,
            loseIncrement,
          ],
          function (err) {
            if (err) {
              console.error(`❌ Error updating player ${playerNumber}:`, err);
              hasError = true;
            } else {
              console.log(
                `✅ Updated stats for player ${playerNumber} (${index + 1}/${playerNumbers.length})`
              );
            }

            completedCount++;

            if (completedCount === playerNumbers.length) {
              stmt.finalize(finalizeErr => {
                if (finalizeErr) {
                  console.error('Error finalizing statement:', finalizeErr);
                }

                if (hasError) {
                  db.run('ROLLBACK', rollbackErr => {
                    if (rollbackErr) {
                      console.error(
                        'Error rolling back transaction:',
                        rollbackErr
                      );
                    }
                    console.error('❌ Transaction rolled back due to errors');
                    reject(new Error('Some updates failed'));
                  });
                } else {
                  db.run('COMMIT', commitErr => {
                    if (commitErr) {
                      console.error('Error committing transaction:', commitErr);
                      reject(commitErr);
                    } else {
                      console.log(`✅ Successfully updated ${playerNumbers.length} player(s)`);
                      resolve();
                    }
                  });
                }
              });
            }
          }
        );
      });
    });
  });
}

/**
 * Upsert full totals for a player and recompute winrate.
 *
 * @param {number} playerNumber
 * @param {number} totalMatch
 * @param {number} totalWin
 * @param {number} totalLose
 * @param {number} [totalDraw=0]
 * @returns {Promise<void>}
 */
async function upsertTotals(
  playerNumber,
  totalMatch,
  totalWin,
  totalLose,
  totalDraw = 0
) {
  return new Promise((resolve, reject) => {
    const winrate =
      totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;

    const sql = `
      INSERT OR REPLACE INTO leaderboard (
        player_number,
        total_match,
        total_win,
        total_lose,
        total_draw,
        goal,
        assist,
        winrate,
        updated_at
      ) 
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP)
    `;

    db.run(
      sql,
      [playerNumber, totalMatch, totalWin, totalLose, totalDraw, winrate],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Get stats row for a single player_number.
 *
 * @param {number} playerNumber
 * @returns {Promise<Object|null>}
 */
async function getPlayerStats(playerNumber) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM leaderboard WHERE player_number = ?';

    db.get(sql, [playerNumber], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Get stats rows for multiple player_numbers.
 *
 * @param {Array<number>} playerNumbers
 * @returns {Promise<Array>}
 */
async function getMultiplePlayerStats(playerNumbers) {
  return new Promise((resolve, reject) => {
    const placeholders = playerNumbers.map(() => '?').join(',');
    const sql = `SELECT * FROM leaderboard WHERE player_number IN (${placeholders})`;

    db.all(sql, playerNumbers, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Close underlying database connection.
 *
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('✅ Database connection closed');
        resolve();
      }
    });
  });
}

/**
 * Increment goal count for a player_number.
 * Creates a new row if none exists.
 *
 * @param {number} playerNumber
 * @param {number} goalValue
 * @returns {Promise<void>}
 */
async function updatePlayerGoal(playerNumber, goalValue) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE leaderboard 
      SET goal = COALESCE(goal, 0) + ?, updated_at = CURRENT_TIMESTAMP
      WHERE player_number = ?
    `;

    db.run(sql, [goalValue, playerNumber], function (err) {
      if (err) {
        reject(err);
      } else {
        if (this.changes === 0) {
          const insertSQL = `
            INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at) 
            VALUES (?, 0, 0, 0, 0, ?, 0, 0.0, CURRENT_TIMESTAMP)
          `;
          db.run(insertSQL, [playerNumber, goalValue], function (insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      }
    });
  });
}

/**
 * Increment assist count for a player_number.
 * Creates a new row if none exists.
 *
 * @param {number} playerNumber
 * @param {number} assistValue
 * @returns {Promise<void>}
 */
async function updatePlayerAssist(playerNumber, assistValue) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE leaderboard 
      SET assist = COALESCE(assist, 0) + ?, updated_at = CURRENT_TIMESTAMP
      WHERE player_number = ?
    `;

    db.run(sql, [assistValue, playerNumber], function (err) {
      if (err) {
        reject(err);
      } else {
        if (this.changes === 0) {
          const insertSQL = `
            INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at) 
            VALUES (?, 0, 0, 0, 0, 0, ?, 0.0, CURRENT_TIMESTAMP)
          `;
          db.run(insertSQL, [playerNumber, assistValue], function (insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      }
    });
  });
}

module.exports = {
  findLeaderboardOrdered,
  applyMatchResultBatch,
  upsertTotals,
  getPlayerStats,
  getMultiplePlayerStats,
  updatePlayerGoal,
  updatePlayerAssist,
  closeDatabase,
};
