const http = require('http');
const { URL } = require('url');
const {
  getAllPlayers,
  getPlayerByNumber,
  updatePlayerByNumber,
} = require('./players');
const {
  registerPlayerForAnother,
  deletePlayerByNumber,
} = require('../services/player-service');
const {
  readBotStorage,
  writeBotStorage,
  resetBotStorage,
  syncBotStorageFromVote,
} = require('../services/bot-storage-service');
const {
  MAX_AVATAR_BYTES,
  uploadPlayerAvatar,
} = require('../services/avatar-storage-service');
const { getMultiplePlayerStats } = require('../services/leaderboard-service');
const {
  createMatch,
  deleteMatchByDate,
  getMatchWithPlayers,
  listMatches,
  updateMatchByDate,
} = require('./matches');
const { updatePlayerStats } = require('./leaderboard');
const defaultMatchMediaService = require('../services/match-media-service');
const defaultTwoNikeService = require('../services/two-nike-service');
const {
  createWebhookEventService,
} = require('../services/webhook-event-service');
const {
  isMaintenanceModeEnabled,
  getMaintenanceUntil,
} = require('../../config/maintenance');
const {
  STATUS_LOCKED,
  STATUS_OPEN,
  createMatch: createWorldCupMatch,
  deleteMatch: deleteWorldCupMatch,
  getOverallBoard,
  getLeaderboardRows,
  getMemberPredictionBoard,
  getPredictionRowsForMatch,
  isValidMatchId,
  listMatches: listWorldCupMatches,
  listMemberKeys: listWorldCupMemberKeys,
  normalizeMatchId,
  regenerateMemberKey,
  revokeMemberKey,
  setMatchResult,
  setMatchStatus,
  setMemberPrediction,
  updateMatch: updateWorldCupMatch,
  upsertMemberKey,
} = require('../services/world-cup-predictions-service');

const DEFAULT_PORT = Number(
  process.env.API_PORT || process.env.UI_API_PORT || process.env.PORT || 8787
);
const defaultWebhookEventService = createWebhookEventService();

function logRequest(req, res) {
  const startedAt = Date.now();
  const requestUrl = req.url || '/';
  const clientIp =
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    'unknown-ip';

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[API] ${req.method || 'UNKNOWN'} ${requestUrl} -> ${res.statusCode} (${durationMs}ms) ip=${clientIp}`
    );
  });
}

function readJson(req, { maxBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) {
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

function normalizeNullableText(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function isMaintenanceBypassRoute(path, method) {
  if (path === '/healthz') return true;
  if (path === '/api/status' && method === 'GET') return true;
  if (path === '/api/settings') return true;
  return false;
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
      'Access-Control-Allow-Headers':
        'Content-Type, X-Internal-Api-Auth, X-Admin-Role, X-Admin-User-Id, X-Admin-Email, X-Admin-Name',
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

function sendPredictionResult(res, headers, result, successStatus, bodyBuilder) {
  if (result.ok) {
    return sendJson(res, successStatus, bodyBuilder(result), headers);
  }

  if (result.code === 'MATCH_NOT_FOUND' || result.code === 'MEMBER_NOT_FOUND') {
    return sendJson(res, 404, { error: result.code }, headers);
  }

  if (result.code === 'MATCH_EXISTS' || result.code === 'MATCH_SETTLED') {
    return sendJson(res, 409, { error: result.code }, headers);
  }

  return sendJson(res, 400, { error: result.code || 'INVALID_REQUEST' }, headers);
}

function getAdminActorId(req) {
  const rawValue =
    req.headers['x-admin-user-id'] ||
    req.headers['x-admin-email'] ||
    req.headers['x-admin-name'];
  return rawValue == null ? null : String(rawValue);
}

const MATCH_MEDIA_PATH_PREFIX = '/api/matches/by-id';
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const MATCH_MEDIA_BAD_REQUEST_CODES = new Set([
  'DUPLICATE_SOURCE_SLOT',
  'INVALID_CAPTION',
  'INVALID_HIGHLIGHT_ID',
  'INVALID_JSON',
  'INVALID_MATCH_ID',
  'INVALID_OFFSET_SECONDS',
  'INVALID_PREFERRED_SOURCE_SLOT',
  'INVALID_SOURCES',
  'INVALID_SOURCE_SLOT',
  'INVALID_TIMESTAMP_SECONDS',
  'INVALID_YOUTUBE_URL',
  'NO_HIGHLIGHT_FIELDS',
]);

class MatchMediaBodyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function parsePositivePathId(rawValue) {
  if (typeof rawValue !== 'string' || !/^\d+$/.test(rawValue)) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isSafeInteger(value) &&
    value > 0 &&
    value <= POSTGRES_INTEGER_MAX
    ? value
    : null;
}

function parseMatchMediaRoute(path) {
  if (
    path !== MATCH_MEDIA_PATH_PREFIX &&
    !path.startsWith(`${MATCH_MEDIA_PATH_PREFIX}/`)
  ) {
    return null;
  }

  const suffix = path.slice(MATCH_MEDIA_PATH_PREFIX.length);
  if (!suffix.startsWith('/')) {
    return { kind: 'invalidPath' };
  }

  const segments = suffix.slice(1).split('/');
  const resource = segments[1];

  if (
    segments.length === 2 &&
    (resource === 'video-sources' || resource === 'highlights')
  ) {
    const matchId = parsePositivePathId(segments[0]);
    if (!matchId) {
      return { kind: 'invalidId', code: 'INVALID_MATCH_ID' };
    }

    return {
      kind: resource === 'video-sources' ? 'videoSources' : 'highlights',
      matchId,
    };
  }

  if (
    segments.length === 3 &&
    resource === 'highlights' &&
    segments[2] !== ''
  ) {
    const matchId = parsePositivePathId(segments[0]);
    if (!matchId) {
      return { kind: 'invalidId', code: 'INVALID_MATCH_ID' };
    }

    const highlightId = parsePositivePathId(segments[2]);
    if (!highlightId) {
      return { kind: 'invalidId', code: 'INVALID_HIGHLIGHT_ID' };
    }

    return { kind: 'highlight', matchId, highlightId };
  }

  return { kind: 'invalidPath' };
}

function readMatchMediaJson(req, { maxBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    let tooLarge = false;

    req.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.length;

      if (byteLength > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }

      if (!tooLarge) chunks.push(buffer);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(new MatchMediaBodyError('PAYLOAD_TOO_LARGE'));
        return;
      }

      const body = Buffer.concat(chunks).toString('utf8');
      if (!body) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (_error) {
        reject(new MatchMediaBodyError('INVALID_JSON'));
      }
    });

    req.on('error', reject);
  });
}

function sendMatchMediaError(res, headers, code) {
  if (code === 'PAYLOAD_TOO_LARGE') {
    return sendJson(res, 413, { error: code }, headers);
  }
  if (code === 'MATCH_NOT_FOUND' || code === 'HIGHLIGHT_NOT_FOUND') {
    return sendJson(res, 404, { error: code }, headers);
  }
  if (MATCH_MEDIA_BAD_REQUEST_CODES.has(code)) {
    return sendJson(res, 400, { error: code }, headers);
  }

  return sendJson(res, 500, { error: 'INTERNAL_ERROR' }, headers);
}

function sendMatchMediaResult(res, headers, result, successStatus, buildBody) {
  if (!result || !result.ok) {
    return sendMatchMediaError(res, headers, result?.code);
  }

  return sendJson(res, successStatus, buildBody(result), headers);
}

function getAllowedMatchMediaMethods(route) {
  if (route.kind === 'videoSources') return ['GET', 'PUT'];
  if (route.kind === 'highlights') return ['GET', 'POST', 'DELETE'];
  if (route.kind === 'highlight') return ['PUT', 'DELETE'];
  return [];
}

async function handleMatchMediaRequest({
  req,
  res,
  headers,
  url,
  route,
  service,
}) {
  if (route.kind === 'invalidPath') {
    return sendJson(res, 404, { error: 'NOT_FOUND' }, headers);
  }
  if (route.kind === 'invalidId') {
    return sendMatchMediaError(res, headers, route.code);
  }

  const method = req.method || 'GET';
  const allowedMethods = getAllowedMatchMediaMethods(route);
  if (!allowedMethods.includes(method)) {
    return sendJson(
      res,
      405,
      { error: 'METHOD_NOT_ALLOWED' },
      { ...headers, Allow: allowedMethods.join(', ') }
    );
  }

  try {
    if (route.kind === 'videoSources' && method === 'GET') {
      const result = await service.listVideoSources(route.matchId);
      return sendMatchMediaResult(res, headers, result, 200, value => ({
        matchId: value.matchId,
        sources: value.sources,
      }));
    }

    if (route.kind === 'videoSources' && method === 'PUT') {
      const payload = await readMatchMediaJson(req);
      const result = await service.replaceVideoSources(route.matchId, payload);
      return sendMatchMediaResult(res, headers, result, 200, value => ({
        matchId: value.matchId,
        sources: value.sources,
      }));
    }

    if (route.kind === 'highlights' && method === 'GET') {
      const sourceSlot = url.searchParams.has('sourceSlot')
        ? url.searchParams.get('sourceSlot')
        : null;
      const result = await service.listHighlights(route.matchId, sourceSlot);
      return sendMatchMediaResult(res, headers, result, 200, value => ({
        matchId: value.matchId,
        highlights: value.highlights,
      }));
    }

    if (route.kind === 'highlights' && method === 'POST') {
      const payload = await readMatchMediaJson(req);
      const result = await service.createHighlight(
        route.matchId,
        payload,
        getAdminActorId(req)
      );
      return sendMatchMediaResult(res, headers, result, 201, value => ({
        highlight: value.highlight,
      }));
    }

    if (route.kind === 'highlights' && method === 'DELETE') {
      const result = await service.deleteAllHighlights(route.matchId);
      return sendMatchMediaResult(res, headers, result, 200, value => ({
        ok: true,
        deletedCount: value.deletedCount,
      }));
    }

    if (route.kind === 'highlight' && method === 'PUT') {
      const payload = await readMatchMediaJson(req);
      const result = await service.updateHighlight(
        route.matchId,
        route.highlightId,
        payload
      );
      return sendMatchMediaResult(res, headers, result, 200, value => ({
        highlight: value.highlight,
      }));
    }

    const result = await service.deleteHighlight(
      route.matchId,
      route.highlightId
    );
    return sendMatchMediaResult(res, headers, result, 200, () => ({
      ok: true,
    }));
  } catch (error) {
    if (error instanceof MatchMediaBodyError) {
      return sendMatchMediaError(res, headers, error.code);
    }

    console.error('Error handling match media request:', error);
    return sendJson(res, 500, { error: 'INTERNAL_ERROR' }, headers);
  }
}

function validateMatchIdParam(rawMatchId) {
  const matchId = normalizeMatchId(decodeURIComponent(rawMatchId || ''));
  return isValidMatchId(matchId) ? matchId : null;
}

function validateCreatePredictionMatchPayload(payload) {
  const matchNumber = Number(payload?.matchNumber ?? payload?.id);
  const id = normalizeMatchId(matchNumber);
  const homeTeam =
    typeof payload?.homeTeam === 'string' ? payload.homeTeam.trim() : '';
  const awayTeam =
    typeof payload?.awayTeam === 'string' ? payload.awayTeam.trim() : '';
  const date = typeof payload?.date === 'string' ? payload.date.trim() : '';
  const time = typeof payload?.time === 'string' ? payload.time.trim() : '';

  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    return { ok: false, error: 'INVALID_MATCH_NUMBER' };
  }
  if (!isValidMatchId(id)) {
    return { ok: false, error: 'INVALID_MATCH_ID' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'INVALID_DATE' };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: 'INVALID_TIME' };
  }
  if (!homeTeam) {
    return { ok: false, error: 'INVALID_HOME_TEAM' };
  }
  if (!awayTeam) {
    return { ok: false, error: 'INVALID_AWAY_TEAM' };
  }

  return {
    ok: true,
    match: {
      id,
      matchNumber,
      date,
      time,
      homeTeam,
      awayTeam,
    },
  };
}

function validateUpdatePredictionMatchPayload(payload) {
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'homeTeam')) {
    if (typeof payload.homeTeam !== 'string' || !payload.homeTeam.trim()) {
      return { ok: false, error: 'INVALID_HOME_TEAM' };
    }
    updates.homeTeam = payload.homeTeam.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'awayTeam')) {
    if (typeof payload.awayTeam !== 'string' || !payload.awayTeam.trim()) {
      return { ok: false, error: 'INVALID_AWAY_TEAM' };
    }
    updates.awayTeam = payload.awayTeam.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'date')) {
    if (
      typeof payload.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(payload.date.trim())
    ) {
      return { ok: false, error: 'INVALID_DATE' };
    }
    updates.date = payload.date.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'time')) {
    if (
      typeof payload.time !== 'string' ||
      !/^\d{2}:\d{2}$/.test(payload.time.trim())
    ) {
      return { ok: false, error: 'INVALID_TIME' };
    }
    updates.time = payload.time.trim();
  }

  return { ok: true, updates };
}

function normalizeManualPredictionMatchStatus(rawStatus) {
  if (typeof rawStatus !== 'string') return null;

  const status = rawStatus.trim().toUpperCase();
  if (status === STATUS_OPEN) return STATUS_OPEN;
  if (status === STATUS_LOCKED || status === 'CLOSED' || status === 'CLOSE') {
    return STATUS_LOCKED;
  }

  return null;
}

function createUiApiServer({
  getStatus,
  matchMediaService = defaultMatchMediaService,
  twoNikeService = defaultTwoNikeService,
  webhookEventService = defaultWebhookEventService,
} = {}) {
  const startedAt = new Date().toISOString();
  const maintenanceMode = isMaintenanceModeEnabled();
  const maintenanceUntil = getMaintenanceUntil();
  const maintenanceControlledByEnv = maintenanceMode;

  const settings = {
    maintenanceMode,
    debugLogging: true,
    environment: process.env.NODE_ENV || 'development',
    botCommandPrefix: process.env.BOT_COMMAND_PREFIX || '/chiateam-dev',
    allowedChatIds: [],
  };

  const server = http.createServer(async (req, res) => {
    logRequest(req, res);
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
          maintenanceUntil: settings.maintenanceMode ? maintenanceUntil : null,
          settings: {
            maintenanceMode: settings.maintenanceMode,
            maintenanceControlledByEnv,
            debugLogging: settings.debugLogging,
            environment: settings.environment,
          },
          ...(typeof getStatus === 'function' ? getStatus() : {}),
        },
        headers
      );
    }

    if (
      settings.maintenanceMode &&
      !isMaintenanceBypassRoute(path, req.method || 'GET')
    ) {
      return sendJson(
        res,
        503,
        {
          error: 'MAINTENANCE_MODE',
          message: 'Service is temporarily unavailable for maintenance',
          maintenanceUntil,
        },
        headers
      );
    }

    if (path === '/api/settings' && req.method === 'GET') {
      if (!requireAuthenticated(req, res, headers)) return;
      return sendJson(
        res,
        200,
        {
          ...settings,
          maintenanceControlledByEnv,
          maintenanceUntil: settings.maintenanceMode ? maintenanceUntil : null,
        },
        headers
      );
    }

    if (path === '/api/settings' && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;
      try {
        const payload = (await readJson(req)) || {};
        if (typeof payload.maintenanceMode === 'boolean') {
          if (maintenanceControlledByEnv) {
            return sendJson(
              res,
              409,
              {
                error: 'MAINTENANCE_CONTROLLED_BY_ENV',
                message:
                  'Production maintenance mode is controlled by MAINTENANCE_MODE',
                maintenanceUntil,
              },
              headers
            );
          }
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
        return sendJson(
          res,
          200,
          {
            ...settings,
            maintenanceControlledByEnv,
            maintenanceUntil: settings.maintenanceMode ? maintenanceUntil : null,
          },
          headers
        );
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON payload' }, headers);
      }
    }

    if (path === '/api/2nikes' && req.method === 'GET') {
      if (!requireAuthenticated(req, res, headers)) return;

      try {
        const result = await twoNikeService.listTwoNikes(
          url.searchParams.get('videoId')
        );
        if (!result.ok) {
          return sendJson(
            res,
            400,
            { error: result.code || 'INVALID_REQUEST' },
            headers
          );
        }
        return sendJson(res, 200, { twoNikes: result.twoNikes }, headers);
      } catch (error) {
        console.error('Error listing 2nikes:', error);
        return sendJson(res, 500, { error: 'Failed to list 2nikes' }, headers);
      }
    }

    if (path === '/api/2nikes' && req.method === 'POST') {
      if (!requireAuthenticated(req, res, headers)) return;

      let payload;
      try {
        payload = (await readJson(req)) || {};
      } catch (error) {
        return sendJson(res, 400, { error: 'INVALID_PAYLOAD' }, headers);
      }

      try {
        const result = await twoNikeService.createTwoNike(
          payload,
          getAdminActorId(req)
        );
        if (!result.ok) {
          return sendJson(
            res,
            400,
            { error: result.code || 'INVALID_REQUEST' },
            headers
          );
        }
        return sendJson(res, 201, { twoNike: result.twoNike }, headers);
      } catch (error) {
        console.error('Error creating 2nike:', error);
        return sendJson(res, 500, { error: 'Failed to create 2nike' }, headers);
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
        const avatar = normalizeNullableText(payload.avatar);

        if (avatar === undefined) {
          return sendJson(res, 400, { error: 'INVALID_AVATAR' }, headers);
        }

        const result = await registerPlayerForAnother({
          name,
          number,
          avatar,
        });
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

    if (
      path.startsWith('/api/players/') &&
      path.endsWith('/avatar') &&
      req.method === 'POST'
    ) {
      if (!requireAdmin(req, res, headers)) return;

      const numStr = path
        .slice('/api/players/'.length)
        .replace(/\/avatar$/, '');
      const number = Number(numStr);

      if (!Number.isInteger(number) || number <= 0) {
        return sendJson(res, 400, { error: 'INVALID_NUMBER' }, headers);
      }

      try {
        const existingPlayer = await getPlayerByNumber(number);
        if (!existingPlayer) {
          return sendJson(res, 404, { error: 'NOT_FOUND' }, headers);
        }

        const payload = (await readJson(req, {
          maxBytes: Math.ceil(MAX_AVATAR_BYTES * 1.5) + 1024,
        })) || {};
        const upload = await uploadPlayerAvatar({
          playerNumber: number,
          dataBase64: payload.dataBase64,
          contentType: payload.contentType,
        });
        const player = await updatePlayerByNumber(number, {
          avatar: upload.avatar,
        });

        return sendJson(
          res,
          200,
          {
            player,
            avatar: upload.avatar,
            bucket: upload.bucket,
            path: upload.path,
            contentType: upload.contentType,
            size: upload.size,
          },
          headers
        );
      } catch (e) {
        if (e.message === 'Payload too large' || e.code === 'AVATAR_TOO_LARGE') {
          return sendJson(res, 413, { error: 'AVATAR_TOO_LARGE' }, headers);
        }
        if (
          e.code === 'INVALID_AVATAR_DATA' ||
          e.code === 'INVALID_AVATAR_TYPE'
        ) {
          return sendJson(res, 400, { error: e.code }, headers);
        }
        if (e.code === 'STORAGE_NOT_CONFIGURED') {
          return sendJson(
            res,
            500,
            {
              error: e.code,
              message:
                'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET',
            },
            headers
          );
        }
        if (e.code === 'AVATAR_UPLOAD_FAILED') {
          return sendJson(
            res,
            e.statusCode && e.statusCode < 500 ? 400 : 502,
            { error: e.code },
            headers
          );
        }

        console.error('Error uploading player avatar via UI API:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to upload player avatar' },
          headers
        );
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
        if (Object.prototype.hasOwnProperty.call(payload, 'avatar')) {
          const avatar = normalizeNullableText(payload.avatar);
          if (avatar === undefined) {
            return sendJson(res, 400, { error: 'INVALID_AVATAR' }, headers);
          }
          updates.avatar = avatar;
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

    // World Cup Predictions API
    if (path === '/api/world-cup-predictions' && req.method === 'GET') {
      if (!requireAuthenticated(req, res, headers)) return;

      try {
        return sendJson(res, 200, await getOverallBoard(), headers);
      } catch (e) {
        console.error('Error reading World Cup predictions:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to read World Cup predictions' },
          headers
        );
      }
    }

    if (
      path === '/api/world-cup-predictions/matches' &&
      req.method === 'GET'
    ) {
      if (!requireAuthenticated(req, res, headers)) return;

      try {
        return sendJson(res, 200, await listWorldCupMatches(), headers);
      } catch (e) {
        console.error('Error reading World Cup prediction matches:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to read World Cup prediction matches' },
          headers
        );
      }
    }

    if (
      path === '/api/world-cup-predictions/leaderboard' &&
      req.method === 'GET'
    ) {
      if (!requireAuthenticated(req, res, headers)) return;

      try {
        return sendJson(
          res,
          200,
          { rows: await getLeaderboardRows() },
          headers
        );
      } catch (e) {
        console.error('Error reading World Cup prediction leaderboard:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to read World Cup prediction leaderboard' },
          headers
        );
      }
    }

    if (
      path === '/api/world-cup-predictions/member-keys' &&
      req.method === 'GET'
    ) {
      if (!requireAdmin(req, res, headers)) return;

      try {
        return sendJson(res, 200, await listWorldCupMemberKeys(), headers);
      } catch (e) {
        console.error('Error reading World Cup prediction member keys:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to read World Cup prediction member keys' },
          headers
        );
      }
    }

    if (
      path === '/api/world-cup-predictions/member-keys' &&
      req.method === 'POST'
    ) {
      if (!requireAdmin(req, res, headers)) return;

      try {
        const payload = (await readJson(req)) || {};
        const result = await upsertMemberKey(payload);

        if (!result.ok) {
          return sendPredictionResult(res, headers, result, 201, () => ({}));
        }

        return sendJson(res, 201, result.memberKey, headers);
      } catch (e) {
        console.error('Error creating World Cup prediction member key:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to create World Cup prediction member key' },
          headers
        );
      }
    }

    const worldCupMemberKeysPrefix =
      '/api/world-cup-predictions/member-keys/';
    if (path.startsWith(worldCupMemberKeysPrefix)) {
      const suffix = path.slice(worldCupMemberKeysPrefix.length);
      const parts = suffix.split('/').filter(Boolean);
      const memberId = decodeURIComponent(parts[0] || '');

      if (!memberId || parts.length < 1 || parts.length > 2) {
        return sendJson(res, 400, { error: 'INVALID_MEMBER_ID' }, headers);
      }

      if (parts.length === 2 && parts[1] === 'regenerate' && req.method === 'POST') {
        if (!requireAdmin(req, res, headers)) return;

        try {
          const result = await regenerateMemberKey(memberId);

          if (!result.ok) {
            return sendPredictionResult(res, headers, result, 200, () => ({}));
          }

          return sendJson(res, 200, result.memberKey, headers);
        } catch (e) {
          console.error('Error regenerating World Cup prediction member key:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to regenerate World Cup prediction member key' },
            headers
          );
        }
      }

      if (parts.length === 1 && req.method === 'DELETE') {
        if (!requireAdmin(req, res, headers)) return;

        try {
          const result = await revokeMemberKey(memberId);

          if (!result.ok) {
            return sendPredictionResult(res, headers, result, 200, () => ({}));
          }

          return sendJson(res, 200, { ok: true }, headers);
        } catch (e) {
          console.error('Error deleting World Cup prediction member key:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to delete World Cup prediction member key' },
            headers
          );
        }
      }
    }

    const worldCupMemberPrefix = '/api/world-cup-predictions/member/';
    if (path.startsWith(worldCupMemberPrefix)) {
      const suffix = path.slice(worldCupMemberPrefix.length);
      const parts = suffix.split('/').filter(Boolean);
      const key = decodeURIComponent(parts[0] || '');

      if (!key) {
        return sendJson(res, 401, { error: 'INVALID_MEMBER_KEY' }, headers);
      }

      if (parts.length === 1 && req.method === 'GET') {
        try {
          const result = await getMemberPredictionBoard(key);

          if (!result.ok) {
            return sendJson(res, 401, { error: result.code }, headers);
          }

          return sendJson(
            res,
            200,
            {
              member: result.member,
              matches: result.matches,
              predictions: result.predictions,
            },
            headers
          );
        } catch (e) {
          console.error('Error reading World Cup member predictions:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to read World Cup member predictions' },
            headers
          );
        }
      }

      if (
        parts.length === 3 &&
        parts[1] === 'predictions' &&
        req.method === 'PUT'
      ) {
        try {
          const payload = (await readJson(req)) || {};
          const result = await setMemberPrediction(
            key,
            parts[2],
            payload.prediction
          );

          if (!result.ok) {
            const status =
              result.code === 'INVALID_MEMBER_KEY'
                ? 401
                : result.code === 'MATCH_NOT_FOUND'
                  ? 404
                  : result.code === 'MATCH_CLOSED'
                    ? 409
                    : 400;
            return sendJson(res, status, { error: result.code }, headers);
          }

          return sendJson(
            res,
            200,
            {
              member: result.member,
              matches: result.matches,
              predictions: result.predictions,
            },
            headers
          );
        } catch (e) {
          console.error('Error saving World Cup member prediction:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to save World Cup member prediction' },
            headers
          );
        }
      }
    }

    if (
      path === '/api/world-cup-predictions/matches' &&
      req.method === 'POST'
    ) {
      if (!requireAdmin(req, res, headers)) return;

      try {
        const payload = (await readJson(req)) || {};
        const validation = validateCreatePredictionMatchPayload(payload);
        if (!validation.ok) {
          return sendJson(res, 400, { error: validation.error }, headers);
        }

        const result = await createWorldCupMatch(
          validation.match,
          getAdminActorId(req)
        );

        if (!result.ok) {
          return sendPredictionResult(res, headers, result, 201, () => ({}));
        }

        return sendJson(res, 201, result.match, headers);
      } catch (e) {
        console.error('Error creating World Cup prediction match:', e);
        return sendJson(
          res,
          500,
          { error: 'Failed to create World Cup prediction match' },
          headers
        );
      }
    }

    const worldCupPredictionMatchPrefix =
      '/api/world-cup-predictions/matches/';
    if (path.startsWith(worldCupPredictionMatchPrefix)) {
      const suffix = path.slice(worldCupPredictionMatchPrefix.length);
      const parts = suffix.split('/').filter(Boolean);
      const matchId = validateMatchIdParam(parts[0]);

      if (!matchId || parts.length < 1 || parts.length > 2) {
        return sendJson(res, 400, { error: 'INVALID_MATCH_ID' }, headers);
      }

      if (parts.length === 1 && req.method === 'GET') {
        if (!requireAuthenticated(req, res, headers)) return;

        try {
          const detail = await getPredictionRowsForMatch(matchId);

          if (!detail.match) {
            return sendJson(res, 404, { error: 'MATCH_NOT_FOUND' }, headers);
          }

          return sendJson(
            res,
            200,
            { match: detail.match, entries: detail.rows },
            headers
          );
        } catch (e) {
          console.error('Error reading World Cup prediction match:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to read World Cup prediction match' },
            headers
          );
        }
      }

      if (parts.length === 1 && req.method === 'PUT') {
        if (!requireAdmin(req, res, headers)) return;

        try {
          const payload = (await readJson(req)) || {};
          const validation = validateUpdatePredictionMatchPayload(payload);
          if (!validation.ok) {
            return sendJson(res, 400, { error: validation.error }, headers);
          }

          const result = await updateWorldCupMatch(
            matchId,
            validation.updates
          );

          if (!result.ok) {
            return sendPredictionResult(res, headers, result, 200, () => ({}));
          }

          return sendJson(res, 200, result.match, headers);
        } catch (e) {
          console.error('Error updating World Cup prediction match:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to update World Cup prediction match' },
            headers
          );
        }
      }

      if (
        parts.length === 2 &&
        parts[1] === 'status' &&
        req.method === 'POST'
      ) {
        if (!requireAdmin(req, res, headers)) return;

        try {
          const payload = (await readJson(req)) || {};
          const status = normalizeManualPredictionMatchStatus(payload.status);
          if (!status) {
            return sendJson(res, 400, { error: 'INVALID_STATUS' }, headers);
          }

          const result = await setMatchStatus(matchId, status);

          if (!result.ok) {
            return sendPredictionResult(res, headers, result, 200, () => ({}));
          }

          return sendJson(res, 200, result.match, headers);
        } catch (e) {
          console.error('Error updating World Cup prediction match status:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to update World Cup prediction match status' },
            headers
          );
        }
      }

      if (parts.length === 1 && req.method === 'DELETE') {
        if (!requireAdmin(req, res, headers)) return;

        try {
          const result = await deleteWorldCupMatch(matchId);

          if (!result.ok) {
            return sendPredictionResult(res, headers, result, 200, () => ({}));
          }

          return sendJson(res, 200, { ok: true }, headers);
        } catch (e) {
          console.error('Error deleting World Cup prediction match:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to delete World Cup prediction match' },
            headers
          );
        }
      }

      if (parts.length === 2 && req.method === 'POST') {
        if (!requireAdmin(req, res, headers)) return;

        try {
          const action = parts[1];
          let result;

          if (action === 'open') {
            result = await setMatchStatus(matchId, STATUS_OPEN);
          } else if (action === 'close' || action === 'lock') {
            result = await setMatchStatus(matchId, STATUS_LOCKED);
          } else if (action === 'result') {
            result = await setMatchResult(matchId, await readJson(req));
          } else {
            return sendJson(res, 404, { error: 'Not found' }, headers);
          }

          if (!result.ok) {
            return sendPredictionResult(res, headers, result, 200, () => ({}));
          }

          return sendJson(res, 200, result.match, headers);
        } catch (e) {
          console.error('Error changing World Cup prediction match:', e);
          return sendJson(
            res,
            500,
            { error: 'Failed to change World Cup prediction match' },
            headers
          );
        }
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

    const matchMediaRoute = parseMatchMediaRoute(path);
    if (matchMediaRoute) {
      return handleMatchMediaRequest({
        req,
        res,
        headers,
        url,
        route: matchMediaRoute,
        service: matchMediaService,
      });
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

    // Webhook Event API
    if (path.startsWith('/api/webhook-events/') && req.method === 'POST') {
      if (!requireAdmin(req, res, headers)) return;

      const operation = path.slice('/api/webhook-events/'.length);

      if (!['claim', 'complete', 'release'].includes(operation)) {
        return sendJson(res, 404, { error: 'Not found' }, headers);
      }

      try {
        const payload = (await readJson(req)) || {};
        const result = await webhookEventService[operation](payload);

        if (!result.ok) {
          return sendJson(
            res,
            400,
            { error: result.code || 'INVALID_WEBHOOK_EVENT' },
            headers
          );
        }

        return sendJson(res, 200, result, headers);
      } catch (error) {
        console.error(`Error handling webhook event ${operation}:`, error);
        return sendJson(
          res,
          500,
          { error: 'Failed to update webhook event' },
          headers
        );
      }
    }

    // Bot Storage API
    if (path === '/api/bot-storage' && req.method === 'GET') {
      try {
        return sendJson(res, 200, await readBotStorage(), headers);
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
        const toSave = await writeBotStorage(payload);
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
        return sendJson(res, 200, await resetBotStorage(), headers);
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
        const result = await syncBotStorageFromVote();
        if (!result.ok) {
          return sendJson(
            res,
            result.statusCode || 500,
            result.body || { error: 'Failed to sync from vote' },
            headers
          );
        }
        return sendJson(
          res,
          result.statusCode || 200,
          result.body,
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

  function start(port = DEFAULT_PORT, host) {
    return new Promise((resolve, reject) => {
      const onError = err => {
        server.removeListener('listening', onListening);
        reject(err);
      };

      const onListening = () => {
        server.removeListener('error', onError);
        resolve({ port: server.address().port });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      if (host) {
        server.listen(port, host);
      } else {
        server.listen(port);
      }
    });
  }

  function stop() {
    return new Promise((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(err => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  return { start, stop };
}

module.exports = { createUiApiServer, parseMatchMediaRoute };
