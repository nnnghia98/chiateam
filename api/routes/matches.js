const { db } = require('../db/config');

const MATCH_SIDES = new Set(['HOME', 'AWAY']);
const PLAYER_RESULTS = new Set(['WIN', 'LOSE']);
let matchResultSchemaPromise = null;

async function ensureMatchResultColumns() {
  if (!matchResultSchemaPromise) {
    matchResultSchemaPromise = (async () => {
      await db.query(
        'ALTER TABLE IF EXISTS matches ADD COLUMN IF NOT EXISTS winner_side TEXT'
      );
      await db.query(
        'ALTER TABLE IF EXISTS match_player_stats ADD COLUMN IF NOT EXISTS result TEXT'
      );
    })().catch(error => {
      matchResultSchemaPromise = null;
      throw error;
    });
  }

  return matchResultSchemaPromise;
}

function buildMatchOutcomePlan(previousResults, lineup, winnerSide) {
  if (!MATCH_SIDES.has(winnerSide)) {
    throw new TypeError('winnerSide must be HOME or AWAY');
  }

  const desiredByPlayerId = new Map();
  for (const row of lineup || []) {
    const playerId = Number(row.player_id);
    const playerNumber = Number(row.number);
    const side = String(row.side || '').toUpperCase();

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0 ||
      !Number.isInteger(playerNumber) ||
      playerNumber <= 0 ||
      !MATCH_SIDES.has(side)
    ) {
      continue;
    }

    const existing = desiredByPlayerId.get(playerId);
    if (existing && existing.side !== side) {
      const error = new Error('A registered player is on both match sides.');
      error.code = 'PLAYER_ON_BOTH_SIDES';
      throw error;
    }

    desiredByPlayerId.set(playerId, {
      playerId,
      playerNumber,
      side,
      result: side === winnerSide ? 'WIN' : 'LOSE',
    });
  }

  const previousByPlayerId = new Map();
  for (const row of previousResults || []) {
    const playerId = Number(row.player_id);
    const playerNumber = Number(row.number);
    const result = String(row.result || '').toUpperCase();

    if (
      Number.isInteger(playerId) &&
      playerId > 0 &&
      Number.isInteger(playerNumber) &&
      playerNumber > 0 &&
      PLAYER_RESULTS.has(result)
    ) {
      previousByPlayerId.set(playerId, {
        playerId,
        playerNumber,
        result,
      });
    }
  }

  const changes = [];
  const playerIds = new Set([
    ...previousByPlayerId.keys(),
    ...desiredByPlayerId.keys(),
  ]);

  for (const playerId of playerIds) {
    const previous = previousByPlayerId.get(playerId) || null;
    const next = desiredByPlayerId.get(playerId) || null;

    if (
      previous?.result === next?.result &&
      previous?.playerNumber === next?.playerNumber
    ) {
      continue;
    }

    changes.push({
      playerId,
      previousPlayerNumber: previous?.playerNumber ?? null,
      nextPlayerNumber: next?.playerNumber ?? null,
      previousResult: previous?.result ?? null,
      nextResult: next?.result ?? null,
    });
  }

  const desiredResults = [...desiredByPlayerId.values()];

  return {
    changes,
    desiredResults,
    winners: desiredResults.filter(item => item.result === 'WIN').length,
    losers: desiredResults.filter(item => item.result === 'LOSE').length,
    unchanged: changes.length === 0,
  };
}

function normalizeMatchPlayerName(value) {
  return String(value ?? '')
    .split(' (')[0]
    .trim()
    .toLowerCase();
}

function buildMatchPlayerLinkPlan(matchPlayers, registeredPlayers) {
  const playersByName = new Map();

  for (const player of registeredPlayers || []) {
    const playerId = Number(player?.id);
    const name = String(player?.name ?? '')
      .trim()
      .toLowerCase();

    if (!Number.isInteger(playerId) || playerId <= 0 || !name) {
      continue;
    }

    const matches = playersByName.get(name) || [];
    matches.push({ id: playerId });
    playersByName.set(name, matches);
  }

  const usedPlayerIds = new Set();
  let alreadyLinked = 0;

  for (const row of matchPlayers || []) {
    const playerId = Number(row?.player_id);
    if (Number.isInteger(playerId) && playerId > 0) {
      alreadyLinked += 1;
      usedPlayerIds.add(playerId);
    }
  }

  const links = [];
  let unmatched = 0;
  let ambiguous = 0;
  const candidateUseCounts = new Map();

  for (const row of matchPlayers || []) {
    const currentPlayerId = Number(row?.player_id);
    if (Number.isInteger(currentPlayerId) && currentPlayerId > 0) {
      continue;
    }

    const name = normalizeMatchPlayerName(row?.display_name);
    const candidates = name ? playersByName.get(name) || [] : [];
    if (candidates.length === 1) {
      const candidateId = candidates[0].id;
      candidateUseCounts.set(
        candidateId,
        (candidateUseCounts.get(candidateId) || 0) + 1
      );
    }
  }

  for (const row of matchPlayers || []) {
    const currentPlayerId = Number(row?.player_id);
    if (Number.isInteger(currentPlayerId) && currentPlayerId > 0) {
      continue;
    }

    const name = normalizeMatchPlayerName(row?.display_name);
    const candidates = name ? playersByName.get(name) || [] : [];

    if (candidates.length === 0) {
      unmatched += 1;
      continue;
    }

    const candidate = candidates[0];
    const matchPlayerId = Number(row?.id);
    if (
      candidates.length !== 1 ||
      usedPlayerIds.has(candidate.id) ||
      candidateUseCounts.get(candidate.id) !== 1 ||
      !Number.isInteger(matchPlayerId) ||
      matchPlayerId <= 0
    ) {
      ambiguous += 1;
      continue;
    }

    links.push({ matchPlayerId, playerId: candidate.id });
    usedPlayerIds.add(candidate.id);
  }

  return {
    links,
    alreadyLinked,
    unmatched,
    ambiguous,
    total: Array.isArray(matchPlayers) ? matchPlayers.length : 0,
  };
}

/**
 * Low-level repository for matches, match_players, and match_player_stats.
 * Migrated from SQLite (sqlite3 callbacks) to PostgreSQL (pg async/await).
 */

/**
 * Get match by date (YYYY-MM-DD).
 */
async function getMatchByDate(matchDate) {
  const { rows } = await db.query(
    'SELECT * FROM matches WHERE match_date = $1',
    [matchDate]
  );
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
async function createOrUpdateMatch({
  matchDate,
  san,
  tiensan,
  homePlayers,
  awayPlayers,
  extraPlayers = [],
}) {
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
  await db.query(
    'UPDATE match_player_stats SET is_mvp = 0 WHERE match_id = $1',
    [matchId]
  );
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
 * Apply one HOME/AWAY result to registered players in a saved match.
 * Stored per-match outcomes make this idempotent and allow later corrections.
 */
async function applyMatchOutcome(matchDate, winnerSide) {
  const normalizedWinner = String(winnerSide || '').toUpperCase();
  if (!MATCH_SIDES.has(normalizedWinner)) {
    throw new TypeError('winnerSide must be HOME or AWAY');
  }

  await ensureMatchResultColumns();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: matchRows } = await client.query(
      `SELECT id, winner_side
       FROM matches
       WHERE match_date = $1
       FOR UPDATE`,
      [matchDate]
    );
    const match = matchRows[0];
    if (!match) {
      const error = new Error('Match not found');
      error.code = 'MATCH_NOT_FOUND';
      throw error;
    }

    const { rows: lineup } = await client.query(
      `SELECT mp.player_id, mp.side, p.number
       FROM match_players mp
       JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.side IN ('HOME', 'AWAY')`,
      [match.id]
    );
    const { rows: previousResults } = await client.query(
      `SELECT stats.player_id, stats.result, p.number
       FROM match_player_stats stats
       JOIN players p ON p.id = stats.player_id
       WHERE stats.match_id = $1 AND stats.result IS NOT NULL
       FOR UPDATE`,
      [match.id]
    );
    const plan = buildMatchOutcomePlan(
      previousResults,
      lineup,
      normalizedWinner
    );

    if (plan.desiredResults.length === 0 && plan.changes.length === 0) {
      await client.query('COMMIT');
      return {
        unchanged: true,
        winners: 0,
        losers: 0,
        noRegisteredPlayers: true,
      };
    }

    const unchanged = match.winner_side === normalizedWinner && plan.unchanged;
    if (unchanged) {
      await client.query('COMMIT');
      return {
        unchanged: true,
        winners: plan.winners,
        losers: plan.losers,
      };
    }

    const deltasByNumber = new Map();
    for (const change of plan.changes) {
      if (change.previousResult) {
        const delta = deltasByNumber.get(change.previousPlayerNumber) || {
          matches: 0,
          wins: 0,
          losses: 0,
        };
        delta.matches -= 1;
        delta.wins -= change.previousResult === 'WIN' ? 1 : 0;
        delta.losses -= change.previousResult === 'LOSE' ? 1 : 0;
        deltasByNumber.set(change.previousPlayerNumber, delta);
      }
      if (change.nextResult) {
        const delta = deltasByNumber.get(change.nextPlayerNumber) || {
          matches: 0,
          wins: 0,
          losses: 0,
        };
        delta.matches += 1;
        delta.wins += change.nextResult === 'WIN' ? 1 : 0;
        delta.losses += change.nextResult === 'LOSE' ? 1 : 0;
        deltasByNumber.set(change.nextPlayerNumber, delta);
      }
    }

    const playerNumbers = [...deltasByNumber.keys()].sort(
      (left, right) => left - right
    );
    let leaderboardByNumber = new Map();
    if (playerNumbers.length > 0) {
      await client.query(
        `INSERT INTO leaderboard (
           player_number, total_match, total_win, total_lose, total_draw,
           goal, assist, winrate, updated_at
         )
         SELECT player_number, 0, 0, 0, 0, 0, 0, 0, NOW()
         FROM unnest($1::integer[]) AS input(player_number)
         ON CONFLICT (player_number) DO NOTHING`,
        [playerNumbers]
      );
      const { rows } = await client.query(
        `SELECT player_number, total_match, total_win, total_lose, total_draw
         FROM leaderboard
         WHERE player_number = ANY($1)
         ORDER BY player_number
         FOR UPDATE`,
        [playerNumbers]
      );
      leaderboardByNumber = new Map(
        rows.map(row => [Number(row.player_number), row])
      );
    }

    for (const [playerNumber, delta] of deltasByNumber) {
      const current = leaderboardByNumber.get(playerNumber) || {};
      const totalMatch = Number(current.total_match || 0) + delta.matches;
      const totalWin = Number(current.total_win || 0) + delta.wins;
      const totalLose = Number(current.total_lose || 0) + delta.losses;
      const totalDraw = Number(current.total_draw || 0);

      if (
        [totalMatch, totalWin, totalLose, totalDraw].some(value => value < 0)
      ) {
        const error = new Error('Stored leaderboard totals are inconsistent.');
        error.code = 'INVALID_LEADERBOARD_TOTALS';
        throw error;
      }

      const winrate =
        totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;
      await client.query(
        `INSERT INTO leaderboard (
           player_number, total_match, total_win, total_lose, total_draw,
           goal, assist, winrate, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, NOW())
         ON CONFLICT (player_number) DO UPDATE SET
           total_match = EXCLUDED.total_match,
           total_win = EXCLUDED.total_win,
           total_lose = EXCLUDED.total_lose,
           total_draw = EXCLUDED.total_draw,
           winrate = EXCLUDED.winrate,
           updated_at = NOW()`,
        [playerNumber, totalMatch, totalWin, totalLose, totalDraw, winrate]
      );
    }

    await client.query(
      'UPDATE match_player_stats SET result = NULL WHERE match_id = $1',
      [match.id]
    );
    for (const item of plan.desiredResults) {
      await client.query(
        `INSERT INTO match_player_stats (
           match_id, player_id, goals, assists, is_mvp, result
         )
         VALUES ($1, $2, 0, 0, 0, $3)
         ON CONFLICT (match_id, player_id) DO UPDATE SET result = $3`,
        [match.id, item.playerId, item.result]
      );
    }
    await client.query(
      `UPDATE matches
       SET winner_side = $1, updated_at = NOW()
       WHERE id = $2`,
      [normalizedWinner, match.id]
    );

    await client.query('COMMIT');
    return {
      unchanged: false,
      winners: plan.winners,
      losers: plan.losers,
      noRegisteredPlayers: plan.desiredResults.length === 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Link unregistered saved lineup rows to players registered later.
 * Exact normalized names are required; duplicate names are left unchanged.
 */
async function syncMatchPlayerLinks(matchDate) {
  await ensureMatchResultColumns();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: matchRows } = await client.query(
      `SELECT id, winner_side
       FROM matches
       WHERE match_date = $1
       FOR UPDATE`,
      [matchDate]
    );
    const match = matchRows[0];

    if (!match) {
      await client.query('COMMIT');
      return null;
    }

    const { rows: matchPlayers } = await client.query(
      `SELECT id, player_id, display_name
       FROM match_players
       WHERE match_id = $1
       ORDER BY id
       FOR UPDATE`,
      [match.id]
    );
    const { rows: registeredPlayers } = await client.query(
      `SELECT id, name
       FROM players
       ORDER BY id
       FOR SHARE`
    );
    const plan = buildMatchPlayerLinkPlan(matchPlayers, registeredPlayers);
    let linked = 0;

    for (const link of plan.links) {
      const result = await client.query(
        `UPDATE match_players
         SET player_id = $1
         WHERE id = $2 AND match_id = $3 AND player_id IS NULL`,
        [link.playerId, link.matchPlayerId, match.id]
      );
      linked += result.rowCount;
    }

    if (linked > 0) {
      await client.query(
        'UPDATE matches SET updated_at = NOW() WHERE id = $1',
        [match.id]
      );
    }

    await client.query('COMMIT');
    return {
      linked,
      alreadyLinked: plan.alreadyLinked,
      unmatched: plan.unmatched,
      ambiguous: plan.ambiguous,
      total: plan.total,
      winnerSide: match.winner_side || null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a match by date. Cascades to match_players and match_player_stats.
 */
async function deleteMatchByDate(matchDate) {
  const result = await db.query('DELETE FROM matches WHERE match_date = $1', [
    matchDate,
  ]);
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
  applyMatchOutcome,
  buildMatchOutcomePlan,
  buildMatchPlayerLinkPlan,
  ensureMatchResultColumns,
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
  syncMatchPlayerLinks,
};
