const crypto = require('crypto');
const { db } = require('../db/config');

const STATUS_OPEN = 'OPEN';
const STATUS_LOCKED = 'LOCKED';
const STATUS_SETTLED = 'SETTLED';

const VALID_STATUSES = new Set([STATUS_OPEN, STATUS_LOCKED, STATUS_SETTLED]);

let tablesReady = false;

async function ensureWorldCupPredictionTables() {
  if (tablesReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS world_cup_prediction_matches (
      id TEXT PRIMARY KEY,
      match_number INTEGER UNIQUE,
      match_date DATE NOT NULL,
      match_time TIME NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      result SMALLINT CHECK (result IN (0, 1, 2)),
      home_score SMALLINT CHECK (home_score IS NULL OR home_score >= 0),
      away_score SMALLINT CHECK (away_score IS NULL OR away_score >= 0),
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE world_cup_prediction_matches
      ADD COLUMN IF NOT EXISTS home_score SMALLINT CHECK (home_score IS NULL OR home_score >= 0)
  `);

  await db.query(`
    ALTER TABLE world_cup_prediction_matches
      ADD COLUMN IF NOT EXISTS away_score SMALLINT CHECK (away_score IS NULL OR away_score >= 0)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS world_cup_prediction_members (
      member_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      access_key CHAR(6) NOT NULL UNIQUE,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS world_cup_predictions (
      match_id TEXT NOT NULL REFERENCES world_cup_prediction_matches(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES world_cup_prediction_members(member_id) ON DELETE CASCADE,
      prediction SMALLINT NOT NULL CHECK (prediction IN (0, 1, 2)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (match_id, member_id)
    )
  `);

  tablesReady = true;
}

function normalizeMatchId(rawValue) {
  return String(rawValue || '')
    .trim()
    .toUpperCase();
}

function isValidMatchId(matchId) {
  return /^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(matchId);
}

function normalizeMemberId(rawValue) {
  return String(rawValue || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

function isValidMemberId(memberId) {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(memberId);
}

function normalizeOutcome(rawValue) {
  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim() !== ''
        ? Number(rawValue)
        : null;
  return value === 0 || value === 1 || value === 2 ? value : null;
}

function inferOutcomeFromScore(score) {
  const parsedScore = parseScore(score);
  return parsedScore ? parsedScore.outcome : null;
}

function normalizeScoreValue(rawValue) {
  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim() !== ''
        ? Number(rawValue)
        : null;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function outcomeFromScores(homeScore, awayScore) {
  if (homeScore > awayScore) return 1;
  if (awayScore > homeScore) return 2;
  return 0;
}

function parseScore(score) {
  const match = String(score || '')
    .trim()
    .match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const homeScore = Number(match[1]);
  const awayScore = Number(match[2]);
  return {
    homeScore,
    awayScore,
    outcome: outcomeFromScores(homeScore, awayScore),
  };
}

function parseResultInput(resultInput) {
  if (!resultInput || typeof resultInput !== 'object' || Array.isArray(resultInput)) {
    const parsedScore = parseScore(resultInput);
    const outcome = normalizeOutcome(resultInput) ?? parsedScore?.outcome ?? null;
    return {
      outcome,
      homeScore: parsedScore?.homeScore ?? null,
      awayScore: parsedScore?.awayScore ?? null,
    };
  }

  const parsedScore = parseScore(resultInput.score);
  const payloadHomeScore = normalizeScoreValue(resultInput.homeScore);
  const payloadAwayScore = normalizeScoreValue(resultInput.awayScore);
  if (
    parsedScore &&
    ((payloadHomeScore !== null && payloadHomeScore !== parsedScore.homeScore) ||
      (payloadAwayScore !== null && payloadAwayScore !== parsedScore.awayScore))
  ) {
    return { outcome: null, homeScore: null, awayScore: null };
  }

  const homeScore = payloadHomeScore ?? parsedScore?.homeScore ?? null;
  const awayScore = payloadAwayScore ?? parsedScore?.awayScore ?? null;
  const scoreOutcome =
    homeScore === null || awayScore === null
      ? parsedScore?.outcome ?? null
      : outcomeFromScores(homeScore, awayScore);
  const payloadOutcome = normalizeOutcome(resultInput.result);
  if (
    payloadOutcome !== null &&
    scoreOutcome !== null &&
    payloadOutcome !== scoreOutcome
  ) {
    return { outcome: null, homeScore: null, awayScore: null };
  }

  const outcome = payloadOutcome ?? scoreOutcome;

  return { outcome, homeScore, awayScore };
}

function formatDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function getMatchStartAt(match) {
  if (!match?.date || !match?.time) return null;
  const parsed = new Date(`${match.date}T${match.time}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPredictionVisible(match, now = new Date()) {
  const startAt = getMatchStartAt(match);
  return startAt ? now.getTime() >= startAt.getTime() : false;
}

function isPredictionClosed(match, now = new Date()) {
  if (!match || match.status !== STATUS_OPEN) return true;
  return false;
}

function mapMatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    matchNumber: row.match_number,
    date: formatDate(row.match_date),
    time: formatTime(row.match_time),
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    status: row.status,
    result: row.result,
    homeScore: row.home_score,
    awayScore: row.away_score,
    score:
      row.home_score == null || row.away_score == null
        ? null
        : `${row.home_score}-${row.away_score}`,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row) {
  if (!row) return null;
  return {
    id: row.member_id,
    memberId: row.member_id,
    name: row.name,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemberKey(row) {
  if (!row) return null;
  return {
    memberId: row.member_id,
    name: row.name,
    username: row.username,
    key: row.access_key,
    displayKey: row.access_key,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrediction(row, match, { censor = true } = {}) {
  if (!row) return null;
  const visible = !censor || isPredictionVisible(match);
  return {
    memberId: row.member_id,
    matchId: row.match_id,
    prediction: visible ? row.prediction : '***',
    value: visible ? row.prediction : '***',
    censored: !visible,
    updatedAt: row.updated_at,
  };
}

function generateSixDigitKey(existingKeys) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const key = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    if (!existingKeys.has(key)) return key;
  }

  throw new Error('Unable to generate unique member key');
}

async function getExistingKeys(exceptMemberId = null) {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(
    `
      SELECT access_key
      FROM world_cup_prediction_members
      WHERE revoked_at IS NULL
        AND ($1::text IS NULL OR member_id <> $1)
    `,
    [exceptMemberId]
  );
  return new Set(rows.map(row => row.access_key));
}

async function listMatches() {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(`
    SELECT *, (
      SELECT COUNT(*)::int
      FROM world_cup_predictions p
      WHERE p.match_id = m.id
    ) AS prediction_count
    FROM world_cup_prediction_matches m
    ORDER BY match_number NULLS LAST, match_date, match_time, id
  `);
  return rows.map(row => ({
    ...mapMatch(row),
    predictionCount: row.prediction_count,
  }));
}

async function getMatch(matchId) {
  await ensureWorldCupPredictionTables();
  const id = normalizeMatchId(matchId);
  const { rows } = await db.query(
    'SELECT * FROM world_cup_prediction_matches WHERE id = $1',
    [id]
  );
  return mapMatch(rows[0]);
}

async function createMatch(matchInput, actorId) {
  await ensureWorldCupPredictionTables();
  const id = normalizeMatchId(matchInput.id || matchInput.matchNumber);
  if (!isValidMatchId(id)) {
    return { ok: false, code: 'INVALID_MATCH_ID' };
  }

  try {
    const { rows } = await db.query(
      `
        INSERT INTO world_cup_prediction_matches
          (id, match_number, match_date, match_time, home_team, away_team, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        id,
        matchInput.matchNumber,
        matchInput.date,
        matchInput.time,
        matchInput.homeTeam,
        matchInput.awayTeam,
        actorId,
      ]
    );
    return { ok: true, match: mapMatch(rows[0]) };
  } catch (error) {
    if (error.code === '23505') {
      return { ok: false, code: 'MATCH_EXISTS' };
    }
    throw error;
  }
}

async function updateMatch(matchId, updates) {
  await ensureWorldCupPredictionTables();
  const id = normalizeMatchId(matchId);
  const fields = [];
  const values = [];
  let index = 1;

  if (Object.prototype.hasOwnProperty.call(updates, 'date')) {
    fields.push(`match_date = $${index++}`);
    values.push(updates.date);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'time')) {
    fields.push(`match_time = $${index++}`);
    values.push(updates.time);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'homeTeam')) {
    fields.push(`home_team = $${index++}`);
    values.push(updates.homeTeam);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'awayTeam')) {
    fields.push(`away_team = $${index++}`);
    values.push(updates.awayTeam);
  }

  if (!fields.length) return { ok: false, code: 'INVALID_REQUEST' };

  fields.push('updated_at = NOW()');
  values.push(id);
  const { rows } = await db.query(
    `
      UPDATE world_cup_prediction_matches
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING *
    `,
    values
  );

  if (!rows[0]) return { ok: false, code: 'MATCH_NOT_FOUND' };
  return { ok: true, match: mapMatch(rows[0]) };
}

async function deleteMatch(matchId) {
  await ensureWorldCupPredictionTables();
  const result = await db.query(
    'DELETE FROM world_cup_prediction_matches WHERE id = $1',
    [normalizeMatchId(matchId)]
  );
  return result.rowCount ? { ok: true } : { ok: false, code: 'MATCH_NOT_FOUND' };
}

async function setMatchStatus(matchId, status) {
  await ensureWorldCupPredictionTables();
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, code: 'INVALID_STATUS' };
  }

  const current = await getMatch(matchId);
  if (!current) return { ok: false, code: 'MATCH_NOT_FOUND' };

  const { rows } = await db.query(
    `
      UPDATE world_cup_prediction_matches
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [status, current.id]
  );
  return { ok: true, match: mapMatch(rows[0]) };
}

async function setMatchResult(matchId, resultInput) {
  await ensureWorldCupPredictionTables();
  const { outcome, homeScore, awayScore } = parseResultInput(resultInput);
  if (outcome === null) return { ok: false, code: 'INVALID_RESULT' };

  const { rows } = await db.query(
    `
      UPDATE world_cup_prediction_matches
      SET result = $1,
          home_score = COALESCE($2, home_score),
          away_score = COALESCE($3, away_score),
          status = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `,
    [
      outcome,
      homeScore,
      awayScore,
      STATUS_SETTLED,
      normalizeMatchId(matchId),
    ]
  );
  if (!rows[0]) return { ok: false, code: 'MATCH_NOT_FOUND' };
  return { ok: true, match: mapMatch(rows[0]) };
}

async function listMemberKeys() {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(`
    SELECT *
    FROM world_cup_prediction_members
    ORDER BY name, member_id
  `);
  return rows.map(mapMemberKey);
}

async function upsertMemberKey(payload) {
  await ensureWorldCupPredictionTables();
  const memberId = normalizeMemberId(payload.memberId);
  const name = String(payload.name || '').trim();
  const username = payload.username ? String(payload.username) : null;
  const manualKey = payload.key == null ? null : String(payload.key).trim();

  if (!isValidMemberId(memberId)) return { ok: false, code: 'INVALID_MEMBER_ID' };
  if (!name) return { ok: false, code: 'INVALID_NAME' };
  if (manualKey !== null && !/^\d{6}$/.test(manualKey)) {
    return { ok: false, code: 'INVALID_MEMBER_KEY' };
  }

  const existingKeys = await getExistingKeys(memberId);
  const accessKey = manualKey || generateSixDigitKey(existingKeys);
  if (existingKeys.has(accessKey)) return { ok: false, code: 'MEMBER_KEY_EXISTS' };

  const { rows } = await db.query(
    `
      INSERT INTO world_cup_prediction_members
        (member_id, name, username, access_key, revoked_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
      ON CONFLICT (member_id) DO UPDATE SET
        name = EXCLUDED.name,
        username = EXCLUDED.username,
        access_key = EXCLUDED.access_key,
        revoked_at = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [memberId, name, username, accessKey]
  );
  return { ok: true, memberKey: mapMemberKey(rows[0]) };
}

async function regenerateMemberKey(memberIdInput) {
  await ensureWorldCupPredictionTables();
  const memberId = normalizeMemberId(memberIdInput);
  const existing = await getMemberById(memberId);
  if (!existing || existing.revoked_at) return { ok: false, code: 'MEMBER_NOT_FOUND' };

  const accessKey = generateSixDigitKey(await getExistingKeys(memberId));
  const { rows } = await db.query(
    `
      UPDATE world_cup_prediction_members
      SET access_key = $1, revoked_at = NULL, updated_at = NOW()
      WHERE member_id = $2
      RETURNING *
    `,
    [accessKey, memberId]
  );
  return { ok: true, memberKey: mapMemberKey(rows[0]) };
}

async function revokeMemberKey(memberIdInput) {
  await ensureWorldCupPredictionTables();
  const memberId = normalizeMemberId(memberIdInput);
  const { rows } = await db.query(
    `
      UPDATE world_cup_prediction_members
      SET revoked_at = NOW(), updated_at = NOW()
      WHERE member_id = $1 AND revoked_at IS NULL
      RETURNING *
    `,
    [memberId]
  );
  if (!rows[0]) return { ok: false, code: 'MEMBER_NOT_FOUND' };
  return { ok: true, memberKey: mapMemberKey(rows[0]) };
}

async function getMemberById(memberId) {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(
    'SELECT * FROM world_cup_prediction_members WHERE member_id = $1',
    [memberId]
  );
  return rows[0] || null;
}

async function getMemberByKey(rawKey) {
  await ensureWorldCupPredictionTables();
  const key = String(rawKey || '').trim();
  const { rows } = await db.query(
    `
      SELECT *
      FROM world_cup_prediction_members
      WHERE access_key = $1 AND revoked_at IS NULL
    `,
    [key]
  );
  return rows[0] || null;
}

async function listPredictionRows() {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(`
    SELECT
      p.match_id,
      p.member_id,
      p.prediction,
      p.updated_at,
      m.match_date,
      m.match_time
    FROM world_cup_predictions p
    JOIN world_cup_prediction_matches m ON m.id = p.match_id
  `);
  return rows;
}

async function getOverallBoard() {
  await ensureWorldCupPredictionTables();
  const [matches, membersResult, predictionRows] = await Promise.all([
    listMatches(),
    db.query(`
      SELECT *
      FROM world_cup_prediction_members
      WHERE revoked_at IS NULL
      ORDER BY name, member_id
    `),
    listPredictionRows(),
  ]);

  const members = membersResult.rows.map(mapMember);
  const matchById = Object.fromEntries(matches.map(match => [match.id, match]));
  const predictions = Object.fromEntries(
    members.map(member => [member.memberId, {}])
  );

  predictionRows.forEach(row => {
    if (!predictions[row.member_id]) predictions[row.member_id] = {};
    predictions[row.member_id][row.match_id] = mapPrediction(
      row,
      matchById[row.match_id]
    );
  });

  members.forEach(member => {
    matches.forEach(match => {
      if (!Object.prototype.hasOwnProperty.call(predictions[member.memberId], match.id)) {
        predictions[member.memberId][match.id] = null;
      }
    });
  });

  return {
    scoringMode: 'OUTCOME',
    matches,
    members,
    predictions,
    totals: await getTotalsByMember(),
  };
}

async function getTotalsByMember() {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(`
    SELECT
      mem.member_id,
      COALESCE(SUM(CASE WHEN p.prediction = m.result THEN 1 ELSE 0 END), 0)::int AS points
    FROM world_cup_prediction_members mem
    LEFT JOIN world_cup_predictions p ON p.member_id = mem.member_id
    LEFT JOIN world_cup_prediction_matches m
      ON m.id = p.match_id AND m.status = 'SETTLED' AND m.result IS NOT NULL
    WHERE mem.revoked_at IS NULL
    GROUP BY mem.member_id
  `);
  return Object.fromEntries(rows.map(row => [row.member_id, row.points]));
}

async function getLeaderboardRows() {
  await ensureWorldCupPredictionTables();
  const { rows } = await db.query(`
    SELECT
      mem.member_id AS "userId",
      mem.name,
      mem.username,
      COALESCE(SUM(CASE WHEN p.prediction = m.result THEN 1 ELSE 0 END), 0)::int AS points,
      COUNT(p.match_id)::int AS predictions,
      0::int AS "exactScores",
      COALESCE(SUM(CASE WHEN p.prediction = m.result THEN 1 ELSE 0 END), 0)::int AS "correctResults"
    FROM world_cup_prediction_members mem
    LEFT JOIN world_cup_predictions p ON p.member_id = mem.member_id
    LEFT JOIN world_cup_prediction_matches m
      ON m.id = p.match_id AND m.status = 'SETTLED' AND m.result IS NOT NULL
    WHERE mem.revoked_at IS NULL
    GROUP BY mem.member_id, mem.name, mem.username
    ORDER BY points DESC, "correctResults" DESC, predictions ASC, mem.name
  `);
  return rows;
}

async function getPredictionRowsForMatch(matchId) {
  await ensureWorldCupPredictionTables();
  const match = await getMatch(matchId);
  if (!match) return { match: null, rows: [] };

  const { rows } = await db.query(
    `
      SELECT
        p.match_id,
        p.member_id,
        mem.name,
        mem.username,
        p.prediction,
        p.updated_at,
        CASE WHEN m.result IS NOT NULL AND p.prediction = m.result THEN 1 ELSE 0 END AS points
      FROM world_cup_predictions p
      JOIN world_cup_prediction_members mem ON mem.member_id = p.member_id
      JOIN world_cup_prediction_matches m ON m.id = p.match_id
      WHERE p.match_id = $1
      ORDER BY points DESC, mem.name
    `,
    [match.id]
  );

  return {
    match,
    rows: rows.map(row => ({
      memberId: row.member_id,
      userId: row.member_id,
      name: row.name,
      username: row.username,
      prediction: isPredictionVisible(match) ? row.prediction : '***',
      value: isPredictionVisible(match) ? row.prediction : '***',
      censored: !isPredictionVisible(match),
      points: row.points,
      exactScore: false,
      correctWinner: row.points === 1,
      updatedAt: row.updated_at,
    })),
  };
}

async function getMemberPredictionBoard(rawKey) {
  await ensureWorldCupPredictionTables();
  const memberRow = await getMemberByKey(rawKey);
  if (!memberRow) return { ok: false, code: 'INVALID_MEMBER_KEY' };

  const member = mapMember(memberRow);
  const matches = await listMatches();
  const matchById = Object.fromEntries(matches.map(match => [match.id, match]));
  const { rows } = await db.query(
    `
      SELECT match_id, member_id, prediction, updated_at
      FROM world_cup_predictions
      WHERE member_id = $1
    `,
    [member.memberId]
  );

  const predictions = Object.fromEntries(matches.map(match => [match.id, null]));
  rows.forEach(row => {
    predictions[row.match_id] = mapPrediction(row, matchById[row.match_id]);
  });

  return { ok: true, member, matches, predictions };
}

async function setMemberPrediction(rawKey, rawMatchId, rawPrediction) {
  await ensureWorldCupPredictionTables();
  const memberRow = await getMemberByKey(rawKey);
  if (!memberRow) return { ok: false, code: 'INVALID_MEMBER_KEY' };

  const match = await getMatch(rawMatchId);
  if (!match) return { ok: false, code: 'MATCH_NOT_FOUND' };
  if (isPredictionClosed(match)) return { ok: false, code: 'MATCH_CLOSED' };

  const prediction = normalizeOutcome(rawPrediction);
  if (prediction === null) return { ok: false, code: 'INVALID_PREDICTION' };

  await db.query(
    `
      INSERT INTO world_cup_predictions
        (match_id, member_id, prediction, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (match_id, member_id) DO UPDATE SET
        prediction = EXCLUDED.prediction,
        updated_at = NOW()
    `,
    [match.id, memberRow.member_id, prediction]
  );

  return getMemberPredictionBoard(rawKey);
}

module.exports = {
  STATUS_OPEN,
  STATUS_LOCKED,
  STATUS_SETTLED,
  createMatch,
  deleteMatch,
  ensureWorldCupPredictionTables,
  getLeaderboardRows,
  getMemberPredictionBoard,
  getOverallBoard,
  getPredictionRowsForMatch,
  isValidMatchId,
  listMatches,
  listMemberKeys,
  normalizeMatchId,
  normalizeOutcome,
  regenerateMemberKey,
  revokeMemberKey,
  setMatchResult,
  setMatchStatus,
  setMemberPrediction,
  updateMatch,
  upsertMemberKey,
};
