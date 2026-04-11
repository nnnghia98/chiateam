const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const nodePath = require('path');

const BOT_STORAGE_FILE = nodePath.resolve(
  process.cwd(),
  process.env.BOT_STATE_FILE ||
    nodePath.join(__dirname, '../../.runtime/bot/storage.json')
);
const {
  getAllPlayers,
  getPlayerByNumber,
  updatePlayerByNumber,
} = require('./players');
const {
  registerPlayerForAnother,
  deletePlayerByNumber,
} = require('../services/player-service');
const { getMultiplePlayerStats } = require('../services/leaderboard-service');
const {
  createMatch,
  deleteMatchByDate,
  getMatchWithPlayers,
  listMatches,
  updateMatchByDate,
} = require('./matches');
const { updatePlayerStats } = require('./leaderboard');

const DEFAULT_PORT = Number(
  process.env.API_PORT || process.env.UI_API_PORT || process.env.PORT || 8787
);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, statusCode, text, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...extraHeaders,
  });
  res.end(text);
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const baseAllowed = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8389', // Admin site
    'http://127.0.0.1:8389',
  ];
  if (process.env.WEB_UI_URL) {
    baseAllowed.push(process.env.WEB_UI_URL);
  }
  if (process.env.ADMIN_UI_URL) {
    baseAllowed.push(process.env.ADMIN_UI_URL);
  }
  const allowList = new Set(baseAllowed);

  if (origin && allowList.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  // Default: no CORS unless explicitly allowed.
  return {};
}

function getInternalApiAuthToken() {
  if (process.env.INTERNAL_API_AUTH_TOKEN) {
    return process.env.INTERNAL_API_AUTH_TOKEN;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'local-internal-api-token-change-me';
  }

  return null;
}

function getTrustedRole(req) {
  const expectedToken = getInternalApiAuthToken();
  const requestToken = req.headers['x-internal-api-auth'];

  if (!expectedToken || requestToken !== expectedToken) {
    return null;
  }

  const role = req.headers['x-admin-role'];
  return role === 'admin' || role === 'viewer' ? role : null;
}

function isAdmin(req) {
  return getTrustedRole(req) === 'admin';
}

function isAuthenticated(req) {
  return getTrustedRole(req) !== null;
}

function requireAuthenticated(req, res, headers) {
  if (!isAuthenticated(req)) {
    sendJson(
      res,
      401,
      {
        error: 'UNAUTHORIZED',
        message: 'Authenticated admin session required',
      },
      headers
    );
    return false;
  }

  return true;
}

function requireAdmin(req, res, headers) {
  if (!isAdmin(req)) {
    sendJson(
      res,
      403,
      {
        error: 'FORBIDDEN',
        message: 'Admin access required for this operation',
      },
      headers
    );
    return false;
  }
  return true;
}

function createUiApiServer({ getStatus }) {
  const startedAt = new Date().toISOString();

  const settings = {
    maintenanceMode: false,
    debugLogging: true,
    environment: process.env.NODE_ENV || 'development',
    botCommandPrefix: process.env.BOT_COMMAND_PREFIX || '/chiateam-dev',
    allowedChatIds: [],
  };

  const server = http.createServer(async (req, res) => {
    const headers = corsHeaders(req);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      return res.end();
    }

    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`
    );
    const path = url.pathname;

    if (path === '/healthz') {
      return sendText(res, 200, 'ok', headers);
    }

    if (path === '/api/status' && req.method === 'GET') {
      return sendJson(
        res,
        200,
        {
          startedAt,
          online: true,
          settings: {
            maintenanceMode: settings.maintenanceMode,
            debugLogging: settings.debugLogging,
            environment: settings.environment,
          },
          ...(typeof getStatus === 'function' ? getStatus() : {}),
        },
        headers
      );
    }

    if (path === '/api/settings' && req.method === 'GET') {
      if (!requireAuthenticated(req, res, headers)) return;
      return sendJson(res, 200, settings, headers);
    }

    if (path === '/api/settings' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;
      try {
        const payload = (await readJson(req)) || {};
        if (typeof payload.maintenanceMode === 'boolean') {
          settings.maintenanceMode = payload.maintenanceMode;
        }
        if (typeof payload.debugLogging === 'boolean') {
          settings.debugLogging = payload.debugLogging;
        }
        if (typeof payload.botCommandPrefix === 'string') {
          settings.botCommandPrefix = payload.botCommandPrefix;
        }
        if (Array.isArray(payload.allowedChatIds)) {
          settings.allowedChatIds = payload.allowedChatIds;
        }
        return sendJson(res, 200, settings, headers);
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON payload' }, headers);
      }
    }

    // Players management API (for admin UI)
    if (path === '/api/players' && req.method === 'GET') {
      try {
        const players = await getAllPlayers();
        return sendJson(res, 200, players, headers);
      } catch (e) {
        console.error('Error fetching players via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to fetch players' },
          headers
        );
      }
    }

    if (path === '/api/player-summaries' && req.method === 'GET') {
      try {
        const players = await getAllPlayers();
        if (!players.length) {
          return sendJson(res, 200, [], headers);
        }
        const numbers = players.map(p => p.number);
        const statsRows = await getMultiplePlayerStats(numbers);
        const byNumber = {};
        (statsRows || []).forEach(row => {
          byNumber[row.player_number] = row;
        });

        const items = players.map(p => {
          const s = byNumber[p.number] || {};
          return {
            player: p,
            stats: {
              total_match: s.total_match ?? 0,
              total_win: s.total_win ?? 0,
              total_lose: s.total_lose ?? 0,
              total_draw: s.total_draw ?? 0,
              goal: s.goal ?? 0,
              assist: s.assist ?? 0,
              winrate: s.winrate ?? 0,
            },
          };
        });

        return sendJson(res, 200, items, headers);
      } catch (e) {
        console.error('Error fetching player summaries via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to fetch player summaries' },
          headers
        );
      }
    }

    if (path === '/api/players' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;

      try {
        const payload = (await readJson(req)) || {};
        const name = typeof payload.name === 'string' ? payload.name : '';
        const number = Number(payload.number);

        const result = await registerPlayerForAnother({ name, number });
        if (!result.ok) {
          if (
            result.code === 'INVALID_NAME' ||
            result.code === 'INVALID_NUMBER'
          ) {
            return sendJson(
              res,
              400,
              { error: result.code, data: result.data || {} },
              headers
            );
          }
          return sendJson(
            res,
            500,
            { error: result.code || 'UNEXPECTED_ERROR' },
            headers
          );
        }

        return sendJson(res, 201, result.player, headers);
      } catch (e) {
        console.error('Error creating player via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to create player' },
          headers
        );
      }
    }

    if (path.startsWith('/api/players/') && req.method === 'GET') {
      const numStr = path.slice('/api/players/'.length);
      const number = Number(numStr);

      if (!Number.isInteger(number) || number <= 0) {
        return sendJson(res, 400, { error: 'INVALID_NUMBER' }, headers);
      }

      try {
        const player = await getPlayerByNumber(number);
        if (!player) {
          return sendJson(res, 404, { error: 'NOT_FOUND' }, headers);
        }

        return sendJson(res, 200, player, headers);
      } catch (e) {
        console.error('Error fetching player via UI API:', e);
        return sendJson(res, 500, { error: 'Failed to fetch player' }, headers);
      }
    }

    if (path.startsWith('/api/players/') && req.method === 'PUT') {
      if (!requireAdmin(req, res, headers)) return;

      const numStr = path.slice('/api/players/'.length);
      const number = Number(numStr);

      if (!Number.isInteger(number) || number <= 0) {
        return sendJson(res, 400, { error: 'INVALID_NUMBER' }, headers);
      }

      try {
        const payload = (await readJson(req)) || {};
        const updates = {};

        if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
          updates.name =
            typeof payload.name === 'string'
              ? payload.name.trim()
              : payload.name;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'username')) {
          updates.username =
            payload.username == null || payload.username === ''
              ? null
              : String(payload.username);
        }

        const player = await updatePlayerByNumber(number, updates);
        return sendJson(res, 200, player, headers);
      } catch (e) {
        console.error('Error updating player via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to update player' },
          headers
        );
      }
    }

    if (path.startsWith('/api/players/') && req.method === 'DELETE') {
      if (!requireAdmin(req, res, headers)) return;

      const numStr = path.slice('/api/players/'.length);
      const number = Number(numStr);
      if (!Number.isInteger(number) || number <= 0) {
        return sendJson(res, 400, { error: 'INVALID_NUMBER' }, headers);
      }
      try {
        const result = await deletePlayerByNumber(number);
        if (!result.ok) {
          if (result.code === 'NOT_FOUND') {
            return sendJson(res, 404, { error: 'NOT_FOUND' }, headers);
          }
          return sendJson(
            res,
            500,
            { error: result.code || 'UNEXPECTED_ERROR' },
            headers
          );
        }
        return sendJson(res, 200, { ok: true }, headers);
      } catch (e) {
        console.error('Error deleting player via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to delete player' },
          headers
        );
      }
    }

    // Matches API
    if (path === '/api/matches' && req.method === 'GET') {
      try {
        const limit = Math.min(
          parseInt(url.searchParams.get('limit') || '20', 10),
          100
        );
        const offset = Math.max(
          parseInt(url.searchParams.get('offset') || '0', 10),
          0
        );

        const matches = await listMatches(limit, offset);

        // Fetch players for each match
        const matchesWithPlayers = await Promise.all(
          matches.map(async match => {
            const fullMatch = await getMatchWithPlayers(match.match_date);
            return fullMatch || match;
          })
        );

        return sendJson(res, 200, matchesWithPlayers, headers);
      } catch (e) {
        console.error('Error fetching matches via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to fetch matches' },
          headers
        );
      }
    }

    if (path.startsWith('/api/matches/') && req.method === 'GET') {
      const matchDate = path.slice('/api/matches/'.length);
      try {
        const match = await getMatchWithPlayers(matchDate);
        if (!match) {
          return sendJson(res, 404, { error: 'Match not found' }, headers);
        }
        return sendJson(res, 200, match, headers);
      } catch (e) {
        console.error('Error fetching match via UI API:', e);
        return sendJson(res, 500, { error: 'Failed to fetch match' }, headers);
      }
    }

    if (path === '/api/matches' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;

      try {
        const payload = (await readJson(req)) || {};
        const matchDate =
          typeof payload.match_date === 'string' ? payload.match_date : '';

        if (!matchDate) {
          return sendJson(res, 400, { error: 'INVALID_MATCH_DATE' }, headers);
        }

        const match = await createMatch({
          matchDate,
          san: payload.san ?? null,
          tiensan: payload.tiensan ?? null,
          homeScore: payload.home_score ?? null,
          awayScore: payload.away_score ?? null,
          notes: payload.notes ?? null,
        });

        return sendJson(res, 201, match, headers);
      } catch (e) {
        console.error('Error creating match via UI API:', e);
        return sendJson(res, 500, { error: 'Failed to create match' }, headers);
      }
    }

    if (path.startsWith('/api/matches/') && req.method === 'PUT') {
      if (!requireAdmin(req, res, headers)) return;

      const matchDate = path.slice('/api/matches/'.length);

      try {
        const payload = (await readJson(req)) || {};
        const updates = {};

        if (Object.prototype.hasOwnProperty.call(payload, 'san')) {
          updates.san = payload.san ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'tiensan')) {
          updates.tiensan = payload.tiensan ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'home_score')) {
          updates.homeScore = payload.home_score ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'away_score')) {
          updates.awayScore = payload.away_score ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
          updates.notes = payload.notes ?? null;
        }

        const match = await updateMatchByDate(matchDate, updates);

        if (!match) {
          return sendJson(res, 404, { error: 'NOT_FOUND' }, headers);
        }

        return sendJson(res, 200, match, headers);
      } catch (e) {
        console.error('Error updating match via UI API:', e);
        return sendJson(res, 500, { error: 'Failed to update match' }, headers);
      }
    }

    if (path.startsWith('/api/matches/') && req.method === 'DELETE') {
      if (!requireAdmin(req, res, headers)) return;

      const matchDate = path.slice('/api/matches/'.length);

      try {
        const deleted = await deleteMatchByDate(matchDate);
        if (!deleted) {
          return sendJson(res, 404, { error: 'NOT_FOUND' }, headers);
        }

        return sendJson(res, 200, { ok: true }, headers);
      } catch (e) {
        console.error('Error deleting match via UI API:', e);
        return sendJson(res, 500, { error: 'Failed to delete match' }, headers);
      }
    }

    // Leaderboard API
    if (path.startsWith('/api/leaderboard/') && req.method === 'PUT') {
      if (!requireAdmin(req, res, headers)) return;

      const playerNumberStr = path.slice('/api/leaderboard/'.length);
      const playerNumber = Number(playerNumberStr);

      if (!Number.isInteger(playerNumber) || playerNumber <= 0) {
        return sendJson(res, 400, { error: 'INVALID_PLAYER_NUMBER' }, headers);
      }

      try {
        const payload = (await readJson(req)) || {};
        await updatePlayerStats(playerNumber, payload);
        return sendJson(res, 200, { ok: true }, headers);
      } catch (e) {
        console.error('Error updating leaderboard entry via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to update leaderboard entry' },
          headers
        );
      }
    }

    // Bot Storage API
    const DEFAULT_BOT_STORAGE = {
      bench: [],
      teamA: [],
      teamB: [],
      team3A: [],
      team3B: [],
      team3C: [],
      tiensan: 0,
      tiennuoc: 0,
      teamThua: null,
      activeVote: null,
      lastUpdated: null,
    };

    if (path === '/api/bot-storage' && req.method === 'GET') {
      if (!requireAuthenticated(req, res, headers)) return;
      try {
        if (!fs.existsSync(BOT_STORAGE_FILE)) {
          return sendJson(res, 200, DEFAULT_BOT_STORAGE, headers);
        }
        const raw = fs.readFileSync(BOT_STORAGE_FILE, 'utf8');
        return sendJson(res, 200, JSON.parse(raw), headers);
      } catch (e) {
        console.error('Error reading bot storage:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to read bot storage' },
          headers
        );
      }
    }

    if (path === '/api/bot-storage' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;
      try {
        const payload = (await readJson(req)) || {};
        fs.mkdirSync(nodePath.dirname(BOT_STORAGE_FILE), { recursive: true });
        const vietnamOffset = 7 * 60;
        const localOffset = new Date().getTimezoneOffset();
        const now = new Date(
          Date.now() + (vietnamOffset + localOffset) * 60000
        );
        const toSave = {
          ...DEFAULT_BOT_STORAGE,
          ...payload,
          lastUpdated: now.toISOString().replace('Z', '+07:00'),
        };
        fs.writeFileSync(
          BOT_STORAGE_FILE,
          JSON.stringify(toSave, null, 2),
          'utf8'
        );
        return sendJson(res, 200, toSave, headers);
      } catch (e) {
        console.error('Error saving bot storage:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to save bot storage' },
          headers
        );
      }
    }

    if (path === '/api/bot-storage/reset' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;
      try {
        fs.mkdirSync(nodePath.dirname(BOT_STORAGE_FILE), { recursive: true });
        fs.writeFileSync(
          BOT_STORAGE_FILE,
          JSON.stringify(DEFAULT_BOT_STORAGE, null, 2),
          'utf8'
        );
        return sendJson(res, 200, DEFAULT_BOT_STORAGE, headers);
      } catch (e) {
        console.error('Error resetting bot storage:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to reset bot storage' },
          headers
        );
      }
    }

    if (path === '/api/bot-storage/sync' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;
      try {
        if (!fs.existsSync(BOT_STORAGE_FILE)) {
          return sendJson(
            res,
            404,
            { error: 'No storage file found' },
            headers
          );
        }
        const raw = fs.readFileSync(BOT_STORAGE_FILE, 'utf8');
        const storage = JSON.parse(raw);

        const activeVote = storage.activeVote;
        if (!activeVote) {
          return sendJson(res, 400, { error: 'NO_ACTIVE_VOTE' }, headers);
        }

        const benchMap = new Map(storage.bench || []);
        const voters = Object.values(activeVote.votes || {});
        let addedCount = 0;
        let skippedCount = 0;
        const addedNames = [];
        const skippedNames = [];

        voters.forEach(voter => {
          const userId = voter.id;
          const userName = voter.name;
          const voteOption = voter.options[0];

          if (voteOption === 0) return;

          if (benchMap.has(userId)) {
            skippedCount++;
            skippedNames.push(userName);
          } else {
            benchMap.set(userId, { name: userName, userId });
            addedCount++;
            addedNames.push(userName);
          }

          if (voteOption >= 2) {
            const friendsCount = voteOption - 1;
            for (let i = 1; i <= friendsCount; i++) {
              const friendName = `${userName} ${i}`;
              const friendId = `${userId}_friend_${i}`;
              if (benchMap.has(friendId)) {
                skippedCount++;
                skippedNames.push(friendName);
              } else {
                benchMap.set(friendId, { name: friendName });
                addedCount++;
                addedNames.push(friendName);
              }
            }
          }
        });

        storage.bench = Array.from(benchMap.entries());
        const vietnamOffset = 7 * 60;
        const localOffset = new Date().getTimezoneOffset();
        const now = new Date(
          Date.now() + (vietnamOffset + localOffset) * 60000
        );
        storage.lastUpdated = now.toISOString().replace('Z', '+07:00');
        fs.writeFileSync(
          BOT_STORAGE_FILE,
          JSON.stringify(storage, null, 2),
          'utf8'
        );

        return sendJson(
          res,
          200,
          {
            ok: true,
            addedCount,
            skippedCount,
            addedNames,
            skippedNames,
            storage,
          },
          headers
        );
      } catch (e) {
        console.error('Error syncing bot storage:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to sync from vote' },
          headers
        );
      }
    }

    return sendJson(res, 404, { error: 'Not found' }, headers);
  });

  function start(port = DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
      const onError = err => {
        server.removeListener('listening', onListening);
        reject(err);
      };

      const onListening = () => {
        server.removeListener('error', onError);
        resolve({ port });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port);
    });
  }

  return { start };
}

module.exports = { createUiApiServer };
