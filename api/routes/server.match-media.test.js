const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const matchRouteCalls = [];
const matchesPath = require.resolve('./matches');

require.cache[matchesPath] = {
  id: matchesPath,
  filename: matchesPath,
  loaded: true,
  exports: {
    async createMatch(payload) {
      return {
        id: 8,
        match_date: payload.matchDate,
        san: payload.san,
        tiensan: payload.tiensan,
        home_score: payload.homeScore,
        away_score: payload.awayScore,
        notes: payload.notes,
      };
    },
    async deleteMatchByDate(matchDate) {
      return matchDate !== 'missing';
    },
    async getMatchWithPlayers(matchDate) {
      matchRouteCalls.push(matchDate);
      if (matchDate === 'missing') return null;
      return {
        id: 7,
        match_date: matchDate,
        homePlayers: [],
        awayPlayers: [],
        extraPlayers: [],
      };
    },
    async listMatches() {
      return [];
    },
    async updateMatchByDate(matchDate, updates) {
      if (matchDate === 'missing') return null;
      return { id: 7, match_date: matchDate, notes: updates.notes };
    },
  },
};

const { createUiApiServer, parseMatchMediaRoute } = require('./server');

const AUTH_TOKEN = 'match-media-test-token';
const mediaCalls = [];
const highlight = {
  id: 501,
  matchId: 42,
  timestampSeconds: 930,
  timestamp: '15:30',
  caption: 'Goal',
  preferredSourceSlot: 1,
  createdBy: 'admin@example.com',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

const matchMediaService = {
  async listVideoSources(matchId) {
    mediaCalls.push(['listVideoSources', matchId]);
    if (matchId === 404) return { ok: false, code: 'MATCH_NOT_FOUND' };
    return { ok: true, matchId, sources: [] };
  },
  async replaceVideoSources(matchId, payload) {
    mediaCalls.push(['replaceVideoSources', matchId, payload]);
    return { ok: true, matchId, sources: payload.sources };
  },
  async listHighlights(matchId, sourceSlot) {
    mediaCalls.push(['listHighlights', matchId, sourceSlot]);
    return { ok: true, matchId, highlights: [highlight] };
  },
  async createHighlight(matchId, payload, createdBy) {
    mediaCalls.push(['createHighlight', matchId, payload, createdBy]);
    return {
      ok: true,
      highlight: { ...highlight, caption: payload.caption, createdBy },
    };
  },
  async updateHighlight(matchId, highlightId, payload) {
    mediaCalls.push(['updateHighlight', matchId, highlightId, payload]);
    return {
      ok: true,
      highlight: { ...highlight, id: highlightId, ...payload },
    };
  },
  async deleteHighlight(matchId, highlightId) {
    mediaCalls.push(['deleteHighlight', matchId, highlightId]);
    if (highlightId === 999) {
      return { ok: false, code: 'HIGHLIGHT_NOT_FOUND' };
    }
    return { ok: true };
  },
  async deleteAllHighlights(matchId) {
    mediaCalls.push(['deleteAllHighlights', matchId]);
    return { ok: true, deletedCount: 5 };
  },
};

let server;
let port;
let originalAuthToken;
let originalNodeEnv;

test.before(async () => {
  originalAuthToken = process.env.INTERNAL_API_AUTH_TOKEN;
  originalNodeEnv = process.env.NODE_ENV;
  process.env.INTERNAL_API_AUTH_TOKEN = AUTH_TOKEN;
  process.env.NODE_ENV = 'test';

  server = createUiApiServer({
    getStatus: () => ({}),
    matchMediaService,
  });
  ({ port } = await server.start(0, '127.0.0.1'));
});

test.after(async () => {
  await server.stop();

  if (originalAuthToken == null) {
    delete process.env.INTERNAL_API_AUTH_TOKEN;
  } else {
    process.env.INTERNAL_API_AUTH_TOKEN = originalAuthToken;
  }

  if (originalNodeEnv == null) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

function request({ method = 'GET', path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const rawBody =
      body == null || typeof body === 'string' ? body : JSON.stringify(body);
    const requestHeaders = {
      Connection: 'close',
      ...headers,
    };

    if (rawBody != null) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(rawBody);
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: requestHeaders,
      },
      res => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseBody ? JSON.parse(responseBody) : null,
          });
        });
      }
    );

    req.on('error', reject);
    if (rawBody != null) req.write(rawBody);
    req.end();
  });
}

function authHeaders(role, actor = 'admin@example.com') {
  return {
    'x-internal-api-auth': AUTH_TOKEN,
    'x-admin-role': role,
    'x-admin-email': actor,
  };
}

test('parseMatchMediaRoute separates ID routes from existing date routes', () => {
  assert.deepEqual(parseMatchMediaRoute('/api/matches/by-id/42/highlights'), {
    kind: 'highlights',
    matchId: 42,
  });
  assert.deepEqual(
    parseMatchMediaRoute('/api/matches/by-id/42/video-sources'),
    { kind: 'videoSources', matchId: 42 }
  );
  assert.equal(parseMatchMediaRoute('/api/matches/2026-07-23'), null);
  assert.deepEqual(parseMatchMediaRoute('/api/matches/by-id/42/unknown'), {
    kind: 'invalidPath',
  });
});

test('public match media GET routes do not require admin headers', async () => {
  const sources = await request({
    path: '/api/matches/by-id/42/video-sources',
  });
  assert.equal(sources.status, 200);
  assert.deepEqual(sources.body, { matchId: 42, sources: [] });

  const highlights = await request({
    path: '/api/matches/by-id/42/highlights?sourceSlot=2',
  });
  assert.equal(highlights.status, 200);
  assert.deepEqual(highlights.body, { matchId: 42, highlights: [highlight] });
  assert.deepEqual(mediaCalls.at(-1), ['listHighlights', 42, '2']);
});

test('match media mutations do not require authentication or admin role', async () => {
  const response = await request({
    method: 'PUT',
    path: '/api/matches/by-id/42/video-sources',
    body: { sources: [] },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { matchId: 42, sources: [] });
  assert.deepEqual(mediaCalls.at(-1), [
    'replaceVideoSources',
    42,
    { sources: [] },
  ]);
});

test('highlight mutation routes use their required response contracts', async () => {
  const created = await request({
    method: 'POST',
    path: '/api/matches/by-id/42/highlights',
    body: {
      timestampSeconds: 930,
      caption: 'Created goal',
      preferredSourceSlot: 1,
      createdBy: 'attacker@example.com',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.highlight.createdBy, null);
  assert.deepEqual(mediaCalls.at(-1), [
    'createHighlight',
    42,
    {
      timestampSeconds: 930,
      caption: 'Created goal',
      preferredSourceSlot: 1,
      createdBy: 'attacker@example.com',
    },
    null,
  ]);

  const updated = await request({
    method: 'PUT',
    path: '/api/matches/by-id/42/highlights/501',
    body: { caption: 'Updated goal' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.highlight.caption, 'Updated goal');

  const deleted = await request({
    method: 'DELETE',
    path: '/api/matches/by-id/42/highlights/501',
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { ok: true });

  const deletedAll = await request({
    method: 'DELETE',
    path: '/api/matches/by-id/42/highlights',
  });
  assert.equal(deletedAll.status, 200);
  assert.deepEqual(deletedAll.body, { ok: true, deletedCount: 5 });
});

test('match media routes translate IDs, JSON, not-found, and method errors', async () => {
  const invalidMatchId = await request({
    path: '/api/matches/by-id/nope/highlights',
  });
  assert.equal(invalidMatchId.status, 400);
  assert.equal(invalidMatchId.body.error, 'INVALID_MATCH_ID');

  const invalidHighlightId = await request({
    method: 'DELETE',
    path: '/api/matches/by-id/42/highlights/nope',
  });
  assert.equal(invalidHighlightId.status, 400);
  assert.equal(invalidHighlightId.body.error, 'INVALID_HIGHLIGHT_ID');

  const invalidJson = await request({
    method: 'POST',
    path: '/api/matches/by-id/42/highlights',
    body: '{',
  });
  assert.equal(invalidJson.status, 400);
  assert.equal(invalidJson.body.error, 'INVALID_JSON');

  const tooLarge = await request({
    method: 'POST',
    path: '/api/matches/by-id/42/highlights',
    body: JSON.stringify({ caption: 'x'.repeat(1_000_001) }),
  });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.body.error, 'PAYLOAD_TOO_LARGE');

  const missingMatch = await request({
    path: '/api/matches/by-id/404/video-sources',
  });
  assert.equal(missingMatch.status, 404);
  assert.equal(missingMatch.body.error, 'MATCH_NOT_FOUND');

  const missingHighlight = await request({
    method: 'DELETE',
    path: '/api/matches/by-id/42/highlights/999',
  });
  assert.equal(missingHighlight.status, 404);
  assert.equal(missingHighlight.body.error, 'HIGHLIGHT_NOT_FOUND');

  const wrongMethod = await request({
    method: 'POST',
    path: '/api/matches/by-id/42/video-sources',
  });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.body.error, 'METHOD_NOT_ALLOWED');
  assert.equal(wrongMethod.headers.allow, 'GET, PUT');
});

test('malformed by-id paths never fall through to date routes', async () => {
  const callsBefore = matchRouteCalls.length;
  const malformed = await request({
    path: '/api/matches/by-id/42/not-a-resource',
  });

  assert.equal(malformed.status, 404);
  assert.equal(malformed.body.error, 'NOT_FOUND');
  assert.equal(matchRouteCalls.length, callsBefore);
});

test('existing match date GET response and status behavior stay unchanged', async () => {
  const list = await request({ path: '/api/matches' });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, []);

  const found = await request({ path: '/api/matches/2026-07-23' });
  assert.equal(found.status, 200);
  assert.deepEqual(found.body, {
    id: 7,
    match_date: '2026-07-23',
    homePlayers: [],
    awayPlayers: [],
    extraPlayers: [],
  });

  const missing = await request({ path: '/api/matches/missing' });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'Match not found' });
});

test('existing match mutation response and status behavior stay unchanged', async () => {
  const created = await request({
    method: 'POST',
    path: '/api/matches',
    headers: authHeaders('admin'),
    body: {
      match_date: '2026-07-24',
      san: 'A',
      tiensan: 'B',
      home_score: 1,
      away_score: 2,
      notes: 'Created',
    },
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, {
    id: 8,
    match_date: '2026-07-24',
    san: 'A',
    tiensan: 'B',
    home_score: 1,
    away_score: 2,
    notes: 'Created',
  });

  const updated = await request({
    method: 'PUT',
    path: '/api/matches/2026-07-24',
    headers: authHeaders('admin'),
    body: { notes: 'Updated' },
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body, {
    id: 7,
    match_date: '2026-07-24',
    notes: 'Updated',
  });

  const deleted = await request({
    method: 'DELETE',
    path: '/api/matches/2026-07-24',
    headers: authHeaders('admin'),
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { ok: true });
});
