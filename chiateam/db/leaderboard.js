const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'cham-het.db');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Get leaderboard ordered by winrate
async function getLeaderboard() {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate 
            FROM leaderboard 
            ORDER BY winrate DESC, total_match DESC, total_win DESC
        `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Database error in getLeaderboard:', err);
        reject(err);
      } else {
        console.log('✅ Leaderboard data fetched successfully');
        resolve(rows || []);
      }
    });
  });
}

// Batch update player statistics - optimized for multiple records
async function updatePlayerStats(playerIds, result) {
  return new Promise((resolve, reject) => {
    // Use transaction for batch operations
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const isWin = result === 'WIN';
      const isDraw = result === 'DRAW';
      const winIncrement = isWin ? 1 : 0;
      const loseIncrement = isWin ? 0 : 1;
      const drawIncrement = isDraw ? 1 : 0;

      // Prepare statement for better performance
      const updateSQL = `
                INSERT OR REPLACE INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate) 
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
                                 (COALESCE((SELECT total_lose FROM leaderboard WHERE player_number = ?), 0) + ?) AS REAL), 3
                        )
                        ELSE 0.0
                    END
                )
            `;

      const stmt = db.prepare(updateSQL);
      let completedCount = 0;
      let hasError = false;

      // Process each player ID
      playerIds.forEach((playerId, index) => {
        stmt.run(
          [
            playerId,
            playerId,
            playerId,
            winIncrement,
            playerId,
            loseIncrement,
            playerId,
            drawIncrement,
            playerId,
            winIncrement,
            playerId,
            loseIncrement,
            playerId,
            winIncrement,
            playerId,
            winIncrement,
            playerId,
            loseIncrement,
          ],
          function (err) {
            if (err) {
              console.error(`❌ Error updating player ${playerId}:`, err);
              hasError = true;
            } else {
              console.log(
                `✅ Updated stats for player ${playerId} (${index + 1}/${playerIds.length})`
              );
            }

            completedCount++;

            // Check if all updates are completed
            if (completedCount === playerIds.length) {
              stmt.finalize(finalizeErr => {
                if (finalizeErr) {
                  console.error('Error finalizing statement:', finalizeErr);
                }

                if (hasError) {
                  // Rollback if any error occurred
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
                  // Commit successful transaction
                  db.run('COMMIT', commitErr => {
                    if (commitErr) {
                      console.error('Error committing transaction:', commitErr);
                      reject(commitErr);
                    } else {
                      console.log(
                        `✅ Successfully updated ${playerIds.length} players`
                      );
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

// Update player stats directly with specific values
async function updatePlayerStatsDirect(
  playerId,
  totalMatch,
  totalWin,
  totalLose,
  totalDraw = 0
) {
  return new Promise((resolve, reject) => {
    // Calculate winrate
    const winrate =
      totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;

    const sql = `
      INSERT OR REPLACE INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at) 
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP)
    `;

    db.run(
      sql,
      [playerId, totalMatch, totalWin, totalLose, totalDraw, winrate],
      function (err) {
        if (err) {
          console.error(`❌ Error updating player ${playerId} stats:`, err);
          reject(err);
        } else {
          console.log(
            `✅ Updated stats for player ${playerId}: ${totalMatch} matches, ${totalWin} wins, ${totalLose} losses, ${totalDraw} draws`
          );
          resolve();
        }
      }
    );
  });
}

// Get player stats
async function getPlayerStats(playerId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM leaderboard WHERE player_number = ?';

    db.get(sql, [playerId], (err, row) => {
      if (err) {
        console.error('Database error in getPlayerStats:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Get multiple player stats at once
async function getMultiplePlayerStats(playerIds) {
  return new Promise((resolve, reject) => {
    const placeholders = playerIds.map(() => '?').join(',');
    const sql = `SELECT * FROM leaderboard WHERE player_number IN (${placeholders})`;

    db.all(sql, playerIds, (err, rows) => {
      if (err) {
        console.error('Database error in getMultiplePlayerStats:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

// Close database connection (optional, for cleanup)
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

// Update player goal count
async function updatePlayerGoal(playerId, goalValue) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE leaderboard 
      SET goal = COALESCE(goal, 0) + ?, updated_at = CURRENT_TIMESTAMP
      WHERE player_number = ?
    `;

    db.run(sql, [goalValue, playerId], function (err) {
      if (err) {
        console.error(`❌ Error updating goal for player ${playerId}:`, err);
        reject(err);
      } else {
        if (this.changes === 0) {
          // Player doesn't exist, create new record with default values
          const insertSQL = `
            INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at) 
            VALUES (?, 0, 0, 0, 0, ?, 0, 0.0, CURRENT_TIMESTAMP)
          `;
          db.run(insertSQL, [playerId, goalValue], function (insertErr) {
            if (insertErr) {
              console.error(`❌ Error creating player ${playerId}:`, insertErr);
              reject(insertErr);
            } else {
              console.log(
                `✅ Created new player ${playerId} with ${goalValue} goals`
              );
              resolve();
            }
          });
        } else {
          console.log(`✅ Updated goal for player ${playerId}: +${goalValue}`);
          resolve();
        }
      }
    });
  });
}

// Update player assist count
async function updatePlayerAssist(playerId, assistValue) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE leaderboard 
      SET assist = COALESCE(assist, 0) + ?, updated_at = CURRENT_TIMESTAMP
      WHERE player_number = ?
    `;

    db.run(sql, [assistValue, playerId], function (err) {
      if (err) {
        console.error(`❌ Error updating assist for player ${playerId}:`, err);
        reject(err);
      } else {
        if (this.changes === 0) {
          // Player doesn't exist, create new record with default values
          const insertSQL = `
            INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at) 
            VALUES (?, 0, 0, 0, 0, 0, ?, 0.0, CURRENT_TIMESTAMP)
          `;
          db.run(insertSQL, [playerId, assistValue], function (insertErr) {
            if (insertErr) {
              console.error(`❌ Error creating player ${playerId}:`, insertErr);
              reject(insertErr);
            } else {
              console.log(
                `✅ Created new player ${playerId} with ${assistValue} assists`
              );
              resolve();
            }
          });
        } else {
          console.log(
            `✅ Updated assist for player ${playerId}: +${assistValue}`
          );
          resolve();
        }
      }
    });
  });
}

module.exports = {
  getLeaderboard,
  updatePlayerStats,
  updatePlayerStatsDirect,
  getPlayerStats,
  getMultiplePlayerStats,
  updatePlayerGoal,
  updatePlayerAssist,
  closeDatabase,
};
