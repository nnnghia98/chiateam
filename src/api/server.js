const http = require('http');
const { URL } = require('url');

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

function createRingBuffer(limit) {
  const items = [];
  return {
    push(item) {
      items.unshift(item);
      if (items.length > limit) items.pop();
    },
    list() {
      return items.slice();
    },
  };
}

function createUiApiServer({ getStatus }) {
  const startedAt = new Date().toISOString();
  const logs = createRingBuffer(200);

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

    if (path === '/api/conversations' && req.method === 'GET') {
      return sendJson(
        res,
        200,
        {
          items: logs.list(),
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

    return sendJson(res, 404, { error: 'Not found' }, headers);
  });

  function logConversationEvent(evt) {
    logs.push({
      id: evt.id || `evt_${Date.now()}`,
      user: evt.user || 'unknown',
      command: evt.command || null,
      lastMessage: evt.lastMessage || '',
      status: evt.status || 'ok',
      time: evt.time || new Date().toISOString(),
    });
  }

  function start(port = DEFAULT_PORT) {
    return new Promise(resolve => {
      server.listen(port, () => {
        resolve({ port });
      });
    });
  }

  return { start, logConversationEvent };
}

module.exports = { createUiApiServer };

