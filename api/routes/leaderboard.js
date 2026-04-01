const { db } = require('../db/config');

/**
 * Low-level repository for the `leaderboard` table.
 * Migrated from SQLite (sqlite3 callbacks) to PostgreSQL (pg async/await).
 *
 * Table schema (Supabase):
 * CREATE TABLE leaderboard (
 *   id            SERIAL PRIMARY KEY,
 *   player_number INTEGER NOT NULL UNIQUE,
 *   total_match   INTEGER DEFAULT 0,
 *   total_win     INTEGER DEFAULT 0,
 *   total_lose    INTEGER DEFAULT 0,
 *   total_draw    INTEGER DEFAULT 0,
 *   winrate       FLOAT DEFAULT 0.0,
 *   goal          INTEGER DEFAULT 0,
 *   assist        INTEGER DEFAULT 0,
 *   created_at    TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at    TIMESTAMPTZ DEFAULT NOW()
 * );
 */

/**
 * Get all leaderboard rows ordered by winrate and volume.
 */
async function findLeaderboardOrdered() {
  const { rows } = await db.query(`
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
  `);
  return rows;
}

/**
 * Batch update player statistics for a match result (WIN/LOSE/DRAW).
 * Uses a dedicated pg client for proper transaction support.
 */
async function applyMatchResultBatch(playerNumbers, result) {
  const isWin = result === 'WIN';
  const isDraw = result === 'DRAW';
  const winIncrement = isWin ? 1 : 0;
  const loseIncrement = !isWin && !isDraw ? 1 : 0;
  const drawIncrement = isDraw ? 1 : 0;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const playerNumber of playerNumbers) {
      const sql = `
        INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate)
        VALUES ($1, 1, $2, $3, $4, 0, 0,
          CASE WHEN ($2 + $3) > 0
            THEN ROUND(CAST($2 AS NUMERIC) / CAST($2 + $3 AS NUMERIC), 3)
            ELSE 0.0
          END
        )
        ON CONFLICT (player_number) DO UPDATE SET
          total_match = leaderboard.total_match + 1,
          total_win   = leaderboard.total_win + $2,
          total_lose  = leaderboard.total_lose + $3,
          total_draw  = leaderboard.total_draw + $4,
          winrate = CASE
            WHEN (leaderboard.total_win + $2 + leaderboard.total_lose + $3) > 0
            THEN ROUND(
              CAST(leaderboard.total_win + $2 AS NUMERIC) /
              CAST(leaderboard.total_win + $2 + leaderboard.total_lose + $3 AS NUMERIC),
              3
            )
            ELSE 0.0
          END,
          updated_at = NOW()
      `;
      await client.query(sql, [
        playerNumber,
        winIncrement,
        loseIncrement,
        drawIncrement,
      ]);
      console.log(`✅ Updated stats for player ${playerNumber}`);
    }
    await client.query('COMMIT');
    console.log(`✅ Successfully updated ${playerNumbers.length} player(s)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back due to errors', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Upsert full totals for a player and recompute winrate.
 */
async function upsertTotals(
  playerNumber,
  totalMatch,
  totalWin,
  totalLose,
  totalDraw = 0
) {
  const winrate =
    totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;
  await db.query(
    `INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at)
     VALUES ($1, $2, $3, $4, $5, 0, 0, $6, NOW())
     ON CONFLICT (player_number) DO UPDATE SET
       total_match = $2,
       total_win   = $3,
       total_lose  = $4,
       total_draw  = $5,
       winrate     = $6,
       updated_at  = NOW()`,
    [playerNumber, totalMatch, totalWin, totalLose, totalDraw, winrate]
  );
}

/**
 * Get stats row for a single player_number.
 */
async function getPlayerStats(playerNumber) {
  const { rows } = await db.query(
    'SELECT * FROM leaderboard WHERE player_number = $1',
    [playerNumber]
  );
  return rows[0] || null;
}

/**
 * Get stats rows for multiple player_numbers.
 */
async function getMultiplePlayerStats(playerNumbers) {
  if (!playerNumbers || playerNumbers.length === 0) return [];
  const { rows } = await db.query(
    'SELECT * FROM leaderboard WHERE player_number = ANY($1)',
    [playerNumbers]
  );
  return rows;
}

/**
 * Increment goal count for a player_number. Creates a new row if none exists.
 */
async function updatePlayerGoal(playerNumber, goalValue) {
  await db.query(
    `INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at)
     VALUES ($1, 0, 0, 0, 0, $2, 0, 0.0, NOW())
     ON CONFLICT (player_number) DO UPDATE SET
       goal       = leaderboard.goal + $2,
       updated_at = NOW()`,
    [playerNumber, goalValue]
  );
}

/**
 * Increment assist count for a player_number. Creates a new row if none exists.
 */
async function updatePlayerAssist(playerNumber, assistValue) {
  await db.query(
    `INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at)
     VALUES ($1, 0, 0, 0, 0, 0, $2, 0.0, NOW())
     ON CONFLICT (player_number) DO UPDATE SET
       assist     = leaderboard.assist + $2,
       updated_at = NOW()`,
    [playerNumber, assistValue]
  );
}

/**
 * Update player stats directly (for admin panel).
 */
async function updatePlayerStats(playerNumber, updates) {
  const current = await getPlayerStats(playerNumber);
  if (!current) {
    // Create new entry if doesn't exist
    const totalMatch = updates.total_match ?? 0;
    const totalWin = updates.total_win ?? 0;
    const totalLose = updates.total_lose ?? 0;
    const totalDraw = updates.total_draw ?? 0;
    const goal = updates.goal ?? 0;
    const assist = updates.assist ?? 0;
    const winrate =
      totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;

    await db.query(
      `INSERT INTO leaderboard (player_number, total_match, total_win, total_lose, total_draw, goal, assist, winrate, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        playerNumber,
        totalMatch,
        totalWin,
        totalLose,
        totalDraw,
        goal,
        assist,
        winrate,
      ]
    );
    return;
  }

  // Update existing entry
  const totalMatch = updates.total_match ?? current.total_match;
  const totalWin = updates.total_win ?? current.total_win;
  const totalLose = updates.total_lose ?? current.total_lose;
  const totalDraw = updates.total_draw ?? current.total_draw;
  const goal = updates.goal ?? current.goal;
  const assist = updates.assist ?? current.assist;
  const winrate =
    totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;

  await db.query(
    `UPDATE leaderboard SET
       total_match = $2,
       total_win = $3,
       total_lose = $4,
       total_draw = $5,
       goal = $6,
       assist = $7,
       winrate = $8,
       updated_at = NOW()
     WHERE player_number = $1`,
    [
      playerNumber,
      totalMatch,
      totalWin,
      totalLose,
      totalDraw,
      goal,
      assist,
      winrate,
    ]
  );
}

module.exports = {
  findLeaderboardOrdered,
  applyMatchResultBatch,
  upsertTotals,
  getPlayerStats,
  getMultiplePlayerStats,
  updatePlayerGoal,
  updatePlayerAssist,
  updatePlayerStats,
};
