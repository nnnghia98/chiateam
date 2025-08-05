const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'leaderboard.db');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Get leaderboard ordered by winrate
async function getLeaderboard() {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT player_id, total_match, total_win, total_lose, winrate 
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
      const winIncrement = isWin ? 1 : 0;
      const loseIncrement = isWin ? 0 : 1;

      // Prepare statement for better performance
      const updateSQL = `
                INSERT OR REPLACE INTO leaderboard (player_id, total_match, total_win, total_lose, winrate) 
                VALUES (
                    ?, 
                    COALESCE((SELECT total_match FROM leaderboard WHERE player_id = ?), 0) + 1,
                    COALESCE((SELECT total_win FROM leaderboard WHERE player_id = ?), 0) + ?,
                    COALESCE((SELECT total_lose FROM leaderboard WHERE player_id = ?), 0) + ?,
                    CASE 
                        WHEN (COALESCE((SELECT total_win FROM leaderboard WHERE player_id = ?), 0) + ?) + 
                             (COALESCE((SELECT total_lose FROM leaderboard WHERE player_id = ?), 0) + ?) > 0 
                        THEN ROUND(
                            CAST((COALESCE((SELECT total_win FROM leaderboard WHERE player_id = ?), 0) + ?) AS REAL) / 
                            CAST((COALESCE((SELECT total_win FROM leaderboard WHERE player_id = ?), 0) + ?) + 
                                 (COALESCE((SELECT total_lose FROM leaderboard WHERE player_id = ?), 0) + ?) AS REAL), 3
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

// Get player stats
async function getPlayerStats(playerId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM leaderboard WHERE player_id = ?';

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
    const sql = `SELECT * FROM leaderboard WHERE player_id IN (${placeholders})`;

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

module.exports = {
  getLeaderboard,
  updatePlayerStats,
  getPlayerStats,
  getMultiplePlayerStats,
  closeDatabase,
};
