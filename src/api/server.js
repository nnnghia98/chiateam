const http = require('http');
const { URL } = require('url');
const { getAllPlayers } = require('./players');
const {
  registerPlayerForAnother,
  deletePlayerByNumber,
} = require('../services/player-service');
const {
  getMultiplePlayerStats,
} = require('../services/leaderboard-service');

const DEFAULT_PORT = Number(process.env.UI_API_PORT || process.env.PORT || 8787);

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
  const allowList = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  if (origin && allowList.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  // Default: no CORS unless explicitly allowed.
  return {};
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

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
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
      return sendJson(res, 200, settings, headers);
    }

    if (path === '/api/settings' && req.method === 'POST') {
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

    // Players management API (for web console)
    if (path === '/api/players' && req.method === 'GET') {
      try {
        const players = await getAllPlayers();
        return sendJson(res, 200, players, headers);
      } catch (e) {
        console.error('Error fetching players via UI API:', e);
        return sendJson(res, 500, { error: 'Failed to fetch players' }, headers);
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
        return sendJson(res, 500, { error: 'Failed to fetch player summaries' }, headers);
      }
    }

    if (path === '/api/players' && req.method === 'POST') {
      try {
        const payload = (await readJson(req)) || {};
        const name = typeof payload.name === 'string' ? payload.name : '';
        const number = Number(payload.number);

        const result = await registerPlayerForAnother({ name, number });
        if (!result.ok) {
          if (result.code === 'INVALID_NAME' || result.code === 'INVALID_NUMBER') {
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
        return sendJson(res, 500, { error: 'Failed to create player' }, headers);
      }
    }

    if (path.startsWith('/api/players/') && req.method === 'DELETE') {
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
        return sendJson(res, 500, { error: 'Failed to delete player' }, headers);
      }
    }

    return sendJson(res, 404, { error: 'Not found' }, headers);
  });

  function start(port = DEFAULT_PORT) {
    return new Promise(resolve => {
      server.listen(port, () => {
        resolve({ port });
      });
    });
  }

  return { start };
}

module.exports = { createUiApiServer };

