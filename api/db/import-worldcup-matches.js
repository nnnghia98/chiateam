require('../../config/load-env').loadEnv();

const fs = require('fs');
const path = require('path');

const { db } = require('./config');
const {
  ensureWorldCupPredictionTables,
} = require('../services/world-cup-predictions-service');

const SOURCE_FILE = path.resolve(__dirname, '../../worldcup.json');
const TARGET_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function parseUtcOffset(rawTime) {
  const match = String(rawTime || '').match(
    /^(\d{1,2}):(\d{2})\s+UTC([+-])(\d{1,2})$/
  );
  if (!match) {
    throw new Error(`Invalid match time: ${rawTime}`);
  }

  const [, hour, minute, sign, offsetHour] = match;
  return {
    hour: hour.padStart(2, '0'),
    minute,
    offset: `${sign}${String(offsetHour).padStart(2, '0')}:00`,
  };
}

function formatInTargetTimeZone(date, time) {
  const parsedTime = parseUtcOffset(time);
  const kickoff = new Date(
    `${date}T${parsedTime.hour}:${parsedTime.minute}:00${parsedTime.offset}`
  );

  if (Number.isNaN(kickoff.getTime())) {
    throw new Error(`Invalid match kickoff: ${date} ${time}`);
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TARGET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(kickoff).map(part => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function inferResult(score) {
  const fullTimeScore = parseFullTimeScore(score);
  if (!fullTimeScore) return null;

  const { homeScore, awayScore } = fullTimeScore;
  if (homeScore > awayScore) return 1;
  if (awayScore > homeScore) return 2;
  return 0;
}

function parseFullTimeScore(score) {
  const fullTime = score?.ft;
  if (!Array.isArray(fullTime) || fullTime.length !== 2) return null;

  const [homeScore, awayScore] = fullTime.map(Number);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  return { homeScore, awayScore };
}

function mapWorldCupMatch(match, index) {
  const matchNumber = Number(match.num || index + 1);
  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    throw new Error(`Invalid match number at index ${index}`);
  }

  const kickoff = formatInTargetTimeZone(match.date, match.time);
  const fullTimeScore = parseFullTimeScore(match.score);
  const result = inferResult(match.score);

  return {
    id: String(matchNumber),
    matchNumber,
    date: kickoff.date,
    time: kickoff.time,
    homeTeam: String(match.team1 || '').trim(),
    awayTeam: String(match.team2 || '').trim(),
    result,
    homeScore: fullTimeScore?.homeScore ?? null,
    awayScore: fullTimeScore?.awayScore ?? null,
    status: result === null ? 'OPEN' : 'SETTLED',
  };
}

function readWorldCupMatches() {
  const data = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  if (!Array.isArray(data.matches)) {
    throw new Error('worldcup.json must contain a matches array');
  }

  const matches = data.matches.map(mapWorldCupMatch);
  const matchNumbers = new Set(matches.map(match => match.matchNumber));
  if (matchNumbers.size !== matches.length) {
    throw new Error('worldcup.json contains duplicate match numbers');
  }

  return matches;
}

async function upsertMatch(client, match) {
  await client.query(
    `
      INSERT INTO world_cup_prediction_matches
        (
          id,
          match_number,
          match_date,
          match_time,
          home_team,
          away_team,
          status,
          result,
          home_score,
          away_score,
          created_by,
          created_at,
          updated_at
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'worldcup.json', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        match_number = EXCLUDED.match_number,
        match_date = EXCLUDED.match_date,
        match_time = EXCLUDED.match_time,
        home_team = EXCLUDED.home_team,
        away_team = EXCLUDED.away_team,
        status = CASE
          WHEN EXCLUDED.result IS NULL THEN world_cup_prediction_matches.status
          ELSE EXCLUDED.status
        END,
        result = CASE
          WHEN EXCLUDED.result IS NULL THEN world_cup_prediction_matches.result
          ELSE EXCLUDED.result
        END,
        home_score = CASE
          WHEN EXCLUDED.result IS NULL THEN world_cup_prediction_matches.home_score
          ELSE EXCLUDED.home_score
        END,
        away_score = CASE
          WHEN EXCLUDED.result IS NULL THEN world_cup_prediction_matches.away_score
          ELSE EXCLUDED.away_score
        END,
        updated_at = NOW()
    `,
    [
      match.id,
      match.matchNumber,
      match.date,
      match.time,
      match.homeTeam,
      match.awayTeam,
      match.status,
      match.result,
      match.homeScore,
      match.awayScore,
    ]
  );
}

async function importWorldCupMatches() {
  const matches = readWorldCupMatches();

  await ensureWorldCupPredictionTables();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    for (const match of matches) {
      await upsertMatch(client, match);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return matches.length;
}

if (require.main === module) {
  importWorldCupMatches()
    .then(count => {
      console.log(`Imported ${count} World Cup matches from worldcup.json`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to import World Cup matches:', error);
      process.exit(1);
    });
}

module.exports = { importWorldCupMatches };
