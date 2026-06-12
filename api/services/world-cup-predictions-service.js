const STATUS_OPEN = 'OPEN';
const STATUS_LOCKED = 'LOCKED';
const STATUS_SETTLED = 'SETTLED';

const VALID_STATUSES = new Set([STATUS_OPEN, STATUS_LOCKED, STATUS_SETTLED]);

function createEmptyPredictionState() {
  return {
    scoringMode: 'OUTCOME',
    matches: {},
    members: {},
    memberKeys: {},
    entries: {},
  };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeMatchId(rawValue) {
  return String(rawValue || '')
    .trim()
    .toUpperCase();
}

function isValidMatchId(matchId) {
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(matchId);
}

function parseScore(rawValue) {
  const match = String(rawValue || '')
    .trim()
    .match(/^(\d{1,2})-(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const homeScore = Number(match[1]);
  const awayScore = Number(match[2]);

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return null;
  }

  return { homeScore, awayScore };
}

function inferWinner(homeScore, awayScore) {
  if (homeScore > awayScore) return 'HOME';
  if (awayScore > homeScore) return 'AWAY';
  return 'DRAW';
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

function outcomeToWinner(value) {
  if (value === 1) return 'HOME';
  if (value === 2) return 'AWAY';
  if (value === 0) return 'DRAW';
  return null;
}

function winnerToOutcome(winner) {
  if (winner === 'HOME') return 1;
  if (winner === 'AWAY') return 2;
  if (winner === 'DRAW') return 0;
  return null;
}

function normalizeMemberId(rawValue) {
  return String(rawValue || '').trim().toLowerCase();
}

function isValidMemberId(memberId) {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(memberId);
}

function normalizeMemberEntry(key, member) {
  if (!member || typeof member !== 'object') return null;
  const id = normalizeMemberId(member.memberId || member.id || key);
  if (!isValidMemberId(id)) return null;
  return [
    id,
    {
      id,
      memberId: id,
      name: String(member.name || id).trim() || id,
      username: member.username ? String(member.username) : null,
      createdAt: member.createdAt || nowIso(),
      updatedAt: member.updatedAt || member.createdAt || nowIso(),
    },
  ];
}

function normalizeMemberKeyEntry(key, memberKey) {
  if (!memberKey || typeof memberKey !== 'object') return null;
  const memberId = normalizeMemberId(memberKey.memberId || memberKey.id || key);
  const keyValue = String(memberKey.key || memberKey.displayKey || '').trim();
  if (!isValidMemberId(memberId) || !/^\d{6}$/.test(keyValue)) return null;
  return [
    memberId,
    {
      memberId,
      name: String(memberKey.name || memberId).trim() || memberId,
      key: keyValue,
      displayKey: keyValue,
      createdAt: memberKey.createdAt || nowIso(),
      updatedAt: memberKey.updatedAt || memberKey.createdAt || nowIso(),
      revokedAt: memberKey.revokedAt || null,
    },
  ];
}

function generateMemberKey(existingKeys) {
  for (let index = 0; index < 1000; index += 1) {
    const key = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    if (!existingKeys.has(key)) return key;
  }
  return String(Date.now()).slice(-6);
}

function formatScore(score) {
  if (!score) {
    return '-';
  }

  return `${score.homeScore}-${score.awayScore}`;
}

function normalizePredictionState(value) {
  if (!value || typeof value !== 'object') {
    return createEmptyPredictionState();
  }

  const matches =
    value.matches &&
    typeof value.matches === 'object' &&
    !Array.isArray(value.matches)
      ? value.matches
      : {};
  const entries =
    value.entries &&
    typeof value.entries === 'object' &&
    !Array.isArray(value.entries)
      ? value.entries
      : {};

  const members =
    value.members &&
    typeof value.members === 'object' &&
    !Array.isArray(value.members)
      ? value.members
      : {};
  const memberKeys =
    value.memberKeys &&
    typeof value.memberKeys === 'object' &&
    !Array.isArray(value.memberKeys)
      ? value.memberKeys
      : {};

  return {
    scoringMode: 'OUTCOME',
    matches: Object.fromEntries(
      Object.entries(matches)
        .map(([key, match]) => normalizeMatchEntry(key, match))
        .filter(Boolean)
    ),
    members: Object.fromEntries(
      Object.entries(members)
        .map(([key, member]) => normalizeMemberEntry(key, member))
        .filter(Boolean)
    ),
    memberKeys: Object.fromEntries(
      Object.entries(memberKeys)
        .map(([key, memberKey]) => normalizeMemberKeyEntry(key, memberKey))
        .filter(Boolean)
    ),
    entries: Object.fromEntries(
      Object.entries(entries)
        .map(([key, matchEntries]) => normalizeMatchEntries(key, matchEntries))
        .filter(Boolean)
    ),
  };
}

function normalizeMatchEntry(key, match) {
  if (!match || typeof match !== 'object') {
    return null;
  }

  const id = normalizeMatchId(match.id || key);
  if (!isValidMatchId(id)) {
    return null;
  }

  const status = VALID_STATUSES.has(match.status) ? match.status : STATUS_OPEN;
  const resultOutcome = normalizeOutcome(match.result);
  const resultScore = resultOutcome === null ? parseScore(formatScore(match.result)) : null;
  const result =
    resultOutcome !== null
      ? resultOutcome
      : resultScore
        ? {
            ...resultScore,
            winner: inferWinner(resultScore.homeScore, resultScore.awayScore),
          }
        : null;

  return [
    id,
    {
      id,
      homeTeam: String(match.homeTeam || '').trim(),
      awayTeam: String(match.awayTeam || '').trim(),
      kickoff: String(match.kickoff || '').trim(),
      status,
      result,
      createdBy: match.createdBy ?? null,
      createdAt: match.createdAt || nowIso(),
      updatedAt: match.updatedAt || match.createdAt || nowIso(),
    },
  ];
}

function normalizeMatchEntries(key, matchEntries) {
  const id = normalizeMatchId(key);
  if (
    !isValidMatchId(id) ||
    !matchEntries ||
    typeof matchEntries !== 'object'
  ) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(matchEntries)
      .map(([userId, entry]) => normalizePredictionEntry(userId, entry))
      .filter(Boolean)
  );

  return [id, normalized];
}

function normalizePredictionEntry(userId, entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = normalizeMemberId(entry.memberId || entry.userId || userId);
  if (!id) return null;

  const explicitValue = normalizeOutcome(entry.value ?? entry.prediction);
  const value = explicitValue ?? winnerToOutcome(entry.winner);
  if (value !== null) {
    return [
      id,
      {
        userId: id,
        memberId: id,
        matchId: entry.matchId ? String(entry.matchId) : undefined,
        name: String(entry.name || id).trim() || id,
        username: entry.username ? String(entry.username) : null,
        value,
        winner: outcomeToWinner(value),
        updatedAt: entry.updatedAt || nowIso(),
      },
    ];
  }

  const parsedScore = parseScore(formatScore(entry));
  if (!parsedScore) return null;
  const winner = inferWinner(parsedScore.homeScore, parsedScore.awayScore);
  return [
    id,
    {
      userId: id,
      memberId: id,
      name: String(entry.name || 'Unknown').trim() || 'Unknown',
      username: entry.username ? String(entry.username) : null,
      homeScore: parsedScore.homeScore,
      awayScore: parsedScore.awayScore,
      winner,
      value: winnerToOutcome(winner),
      updatedAt: entry.updatedAt || nowIso(),
    },
  ];
}

function addMatch(state, matchInput, actorId) {
  const next = normalizePredictionState(state);
  const id = normalizeMatchId(matchInput.id);

  if (next.matches[id]) {
    return { ok: false, code: 'MATCH_EXISTS', state: next };
  }

  const timestamp = nowIso();
  next.matches[id] = {
    id,
    homeTeam: matchInput.homeTeam,
    awayTeam: matchInput.awayTeam,
    kickoff: matchInput.kickoff || '',
    status: STATUS_OPEN,
    result: null,
    createdBy: actorId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  next.entries[id] = {};

  return { ok: true, state: next, match: next.matches[id] };
}

function setMatchStatus(state, matchId, status) {
  const next = normalizePredictionState(state);
  const id = normalizeMatchId(matchId);
  const match = next.matches[id];

  if (!match) {
    return { ok: false, code: 'MATCH_NOT_FOUND', state: next };
  }

  if (!VALID_STATUSES.has(status)) {
    return { ok: false, code: 'INVALID_STATUS', state: next };
  }

  if (match.status === STATUS_SETTLED && status !== STATUS_SETTLED) {
    return { ok: false, code: 'MATCH_SETTLED', state: next, match };
  }

  match.status = status;
  match.updatedAt = nowIso();

  return { ok: true, state: next, match };
}

function deleteMatch(state, matchId) {
  const next = normalizePredictionState(state);
  const id = normalizeMatchId(matchId);

  if (!next.matches[id]) {
    return { ok: false, code: 'MATCH_NOT_FOUND', state: next };
  }

  delete next.matches[id];
  delete next.entries[id];

  return { ok: true, state: next, matchId: id };
}

function setMatchResult(state, matchId, resultInput) {
  const next = normalizePredictionState(state);
  const id = normalizeMatchId(matchId);
  const match = next.matches[id];

  if (!match) {
    return { ok: false, code: 'MATCH_NOT_FOUND', state: next };
  }

  const outcome = normalizeOutcome(resultInput);
  if (outcome !== null) {
    match.status = STATUS_SETTLED;
    match.result = outcome;
    match.updatedAt = nowIso();
    return { ok: true, state: next, match };
  }

  const parsedScore =
    typeof resultInput === 'string'
      ? parseScore(resultInput)
      : parseScore(formatScore(resultInput));
  if (!parsedScore) {
    return { ok: false, code: 'INVALID_RESULT', state: next, match };
  }

  match.status = STATUS_SETTLED;
  match.result = winnerToOutcome(
    inferWinner(parsedScore.homeScore, parsedScore.awayScore)
  );
  match.updatedAt = nowIso();

  return { ok: true, state: next, match };
}

function calculatePredictionPoints(entry, result) {
  if (!entry || !result) {
    return {
      points: 0,
      exactScore: false,
      correctWinner: false,
    };
  }

  const resultValue = normalizeOutcome(result) ?? winnerToOutcome(result.winner);
  const entryValue =
    normalizeOutcome(entry.value ?? entry.prediction) ?? winnerToOutcome(entry.winner);
  const correctWinner =
    resultValue !== null && entryValue !== null && resultValue === entryValue;

  return {
    points: correctWinner ? 1 : 0,
    exactScore: false,
    correctWinner,
  };
}

function getPredictionRowsForMatch(state, matchId) {
  const current = normalizePredictionState(state);
  const id = normalizeMatchId(matchId);
  const match = current.matches[id] || null;

  if (!match) {
    return { match: null, rows: [] };
  }

  const rows = Object.values(current.entries[id] || {}).map(entry => {
    const scoring = calculatePredictionPoints(entry, match.result);
    return {
      ...entry,
      scoreText: `${entry.homeScore}-${entry.awayScore}`,
      ...scoring,
    };
  });

  rows.sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    return left.name.localeCompare(right.name, 'vi');
  });

  return { match, rows };
}

function listMemberKeys(state) {
  const current = normalizePredictionState(state);
  return Object.values(current.memberKeys)
    .filter(memberKey => !memberKey.revokedAt)
    .map(memberKey => ({
      ...memberKey,
      ...(current.members[memberKey.memberId] || {}),
      key: memberKey.key,
      displayKey: memberKey.displayKey || memberKey.key,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
}

function upsertMemberKey(state, payload) {
  const next = normalizePredictionState(state);
  const memberId = normalizeMemberId(payload.memberId);
  const name = String(payload.name || '').trim();
  const manualKey = payload.key == null ? null : String(payload.key).trim();

  if (!isValidMemberId(memberId)) {
    return { ok: false, code: 'INVALID_MEMBER_ID', state: next };
  }
  if (!name) {
    return { ok: false, code: 'INVALID_NAME', state: next };
  }
  if (manualKey !== null && !/^\d{6}$/.test(manualKey)) {
    return { ok: false, code: 'INVALID_MEMBER_KEY', state: next };
  }

  const existingKeys = new Set(
    Object.values(next.memberKeys)
      .filter(memberKey => !memberKey.revokedAt && memberKey.memberId !== memberId)
      .map(memberKey => memberKey.key)
  );
  const key = manualKey || generateMemberKey(existingKeys);
  if (existingKeys.has(key)) {
    return { ok: false, code: 'MEMBER_KEY_EXISTS', state: next };
  }

  const timestamp = nowIso();
  const existingMember = next.members[memberId];
  next.members[memberId] = {
    id: memberId,
    memberId,
    name,
    username: existingMember?.username || null,
    createdAt: existingMember?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  next.memberKeys[memberId] = {
    memberId,
    name,
    key,
    displayKey: key,
    createdAt: next.memberKeys[memberId]?.createdAt || timestamp,
    updatedAt: timestamp,
    revokedAt: null,
  };

  return {
    ok: true,
    state: next,
    member: next.members[memberId],
    memberKey: next.memberKeys[memberId],
  };
}

function regenerateMemberKey(state, memberIdInput) {
  const next = normalizePredictionState(state);
  const memberId = normalizeMemberId(memberIdInput);
  const memberKey = next.memberKeys[memberId];
  if (!memberKey || memberKey.revokedAt) {
    return { ok: false, code: 'MEMBER_NOT_FOUND', state: next };
  }

  const existingKeys = new Set(
    Object.values(next.memberKeys)
      .filter(key => !key.revokedAt && key.memberId !== memberId)
      .map(key => key.key)
  );
  const timestamp = nowIso();
  memberKey.key = generateMemberKey(existingKeys);
  memberKey.displayKey = memberKey.key;
  memberKey.updatedAt = timestamp;
  memberKey.revokedAt = null;
  return { ok: true, state: next, memberKey };
}

function revokeMemberKey(state, memberIdInput) {
  const next = normalizePredictionState(state);
  const memberId = normalizeMemberId(memberIdInput);
  const memberKey = next.memberKeys[memberId];
  if (!memberKey || memberKey.revokedAt) {
    return { ok: false, code: 'MEMBER_NOT_FOUND', state: next };
  }

  memberKey.revokedAt = nowIso();
  memberKey.updatedAt = memberKey.revokedAt;
  return { ok: true, state: next, memberKey };
}

function findMemberByKey(state, rawKey) {
  const current = normalizePredictionState(state);
  const key = String(rawKey || '').trim();
  const memberKey = Object.values(current.memberKeys).find(
    item => item.key === key && !item.revokedAt
  );
  if (!memberKey) return null;

  return {
    memberKey,
    member: current.members[memberKey.memberId] || {
      id: memberKey.memberId,
      memberId: memberKey.memberId,
      name: memberKey.name,
      username: null,
    },
  };
}

function parseMatchStart(match) {
  if (match.date && match.time) {
    const parsed = new Date(`${match.date}T${match.time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const kickoffMatch = String(match.kickoff || '').match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (!kickoffMatch) return null;
  const [, day, month, year, hour, minute] = kickoffMatch;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMatchClosed(match) {
  if (!match || match.status !== STATUS_OPEN) return true;
  const start = parseMatchStart(match);
  if (!start) return false;
  return Date.now() >= start.getTime() - 10 * 60 * 1000;
}

function getMemberPredictionBoard(state, rawKey) {
  const current = normalizePredictionState(state);
  const found = findMemberByKey(current, rawKey);
  if (!found) {
    return { ok: false, code: 'INVALID_MEMBER_KEY', state: current };
  }

  const predictions = {};
  Object.entries(current.entries).forEach(([matchId, matchEntries]) => {
    const entry = matchEntries[found.member.memberId];
    if (entry) predictions[matchId] = entry;
  });

  return {
    ok: true,
    state: current,
    member: found.member,
    matches: Object.values(current.matches),
    predictions,
  };
}

function setMemberPrediction(state, rawKey, rawMatchId, rawPrediction) {
  const next = normalizePredictionState(state);
  const found = findMemberByKey(next, rawKey);
  if (!found) {
    return { ok: false, code: 'INVALID_MEMBER_KEY', state: next };
  }

  const matchId = normalizeMatchId(rawMatchId);
  const match = next.matches[matchId];
  if (!match) {
    return { ok: false, code: 'MATCH_NOT_FOUND', state: next };
  }
  if (isMatchClosed(match)) {
    return { ok: false, code: 'MATCH_CLOSED', state: next };
  }

  const value = normalizeOutcome(rawPrediction);
  if (value === null) {
    return { ok: false, code: 'INVALID_PREDICTION', state: next };
  }

  const timestamp = nowIso();
  next.entries[matchId] = next.entries[matchId] || {};
  next.entries[matchId][found.member.memberId] = {
    userId: found.member.memberId,
    memberId: found.member.memberId,
    matchId,
    name: found.member.name,
    username: found.member.username || null,
    value,
    winner: outcomeToWinner(value),
    updatedAt: timestamp,
  };

  return {
    ok: true,
    state: next,
    member: found.member,
    matches: Object.values(next.matches),
    predictions: {
      [matchId]: next.entries[matchId][found.member.memberId],
    },
  };
}


function getLeaderboardRows(state) {
  const current = normalizePredictionState(state);
  const totals = new Map();

  Object.values(current.matches)
    .filter(match => match.status === STATUS_SETTLED && match.result)
    .forEach(match => {
      Object.values(current.entries[match.id] || {}).forEach(entry => {
        const scoring = calculatePredictionPoints(entry, match.result);
        const userId = String(entry.userId);
        const row = totals.get(userId) || {
          userId,
          name: entry.name,
          username: entry.username || null,
          points: 0,
          predictions: 0,
          exactScores: 0,
          correctResults: 0,
        };

        row.points += scoring.points;
        row.predictions += 1;
        if (scoring.exactScore) row.exactScores += 1;
        if (scoring.correctWinner) row.correctResults += 1;
        totals.set(userId, row);
      });
    });

  return Array.from(totals.values()).sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.exactScores !== left.exactScores) {
      return right.exactScores - left.exactScores;
    }
    if (right.correctResults !== left.correctResults) {
      return right.correctResults - left.correctResults;
    }
    if (left.predictions !== right.predictions) {
      return left.predictions - right.predictions;
    }
    return left.name.localeCompare(right.name, 'vi');
  });
}

module.exports = {
  STATUS_OPEN,
  STATUS_LOCKED,
  STATUS_SETTLED,
  addMatch,
  calculatePredictionPoints,
  createEmptyPredictionState,
  deleteMatch,
  formatScore,
  getLeaderboardRows,
  getMemberPredictionBoard,
  getPredictionRowsForMatch,
  inferWinner,
  isValidMatchId,
  listMemberKeys,
  normalizeMatchId,
  normalizeOutcome,
  normalizePredictionState,
  parseScore,
  regenerateMemberKey,
  revokeMemberKey,
  setMatchResult,
  setMatchStatus,
  setMemberPrediction,
  upsertMemberKey,
};
