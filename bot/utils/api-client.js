const http = require('http');
const https = require('https');
const { resolveInternalApiToken } = require('../../config/internal-auth');

const DEFAULT_API_PORT =
  process.env.API_PORT || process.env.UI_API_PORT || 8787;

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl) {
    return `http://127.0.0.1:${DEFAULT_API_PORT}`;
  }

  const trimmed = String(rawUrl).trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

function getApiBaseUrl(env = process.env) {
  return normalizeBaseUrl(
    env.BOT_API_BASE_URL ||
      env.API_INTERNAL_URL ||
      env.API_BASE_URL ||
      env.API_URL
  );
}

function getInternalApiAuthToken(env = process.env) {
  return resolveInternalApiToken(env);
}

function getDefaultHeaders(env = process.env) {
  const token = getInternalApiAuthToken(env);

  if (!token) {
    throw new Error(
      'Missing INTERNAL_API_AUTH_TOKEN. Set it for bot-to-API storage access.'
    );
  }

  return {
    'Content-Type': 'application/json',
    'x-internal-api-auth': token,
    'x-admin-role': 'admin',
  };
}

function parseResponseBody(rawBody) {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    return rawBody;
  }
}

function requestJson(
  pathname,
  { method = 'GET', body, timeoutMs = 10000, env = process.env } = {}
) {
  const baseUrl = getApiBaseUrl(env);
  const url = new URL(pathname, `${baseUrl}/`);
  const client = url.protocol === 'https:' ? https : http;
  const headers = getDefaultHeaders(env);

  let requestBody = null;
  if (body !== undefined) {
    requestBody = JSON.stringify(body);
    headers['Content-Length'] = Buffer.byteLength(requestBody);
  }

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method,
        headers,
      },
      res => {
        let rawBody = '';

        res.setEncoding('utf8');
        res.on('error', reject);
        res.on('aborted', () =>
          reject(new Error('Internal API response was interrupted.'))
        );
        res.on('data', chunk => {
          rawBody += chunk;
        });
        res.on('end', () => {
          const parsedBody = parseResponseBody(rawBody);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedBody);
            return;
          }

          const error = new Error(
            `API request failed (${method} ${url.pathname}) with status ${res.statusCode}`
          );
          error.statusCode = res.statusCode;
          error.responseBody = parsedBody;
          reject(error);
        });
      }
    );

    req.on('error', reject);

    if (timeoutMs > 0) {
      const timer = setTimeout(() => {
        const error = new Error('Internal API request timed out.');
        error.code = 'API_TIMEOUT';
        req.destroy(error);
      }, timeoutMs);
      req.once('close', () => clearTimeout(timer));
    }

    if (requestBody !== null) {
      req.write(requestBody);
    }

    req.end();
  });
}

function readBotStorage() {
  return requestJson('/api/bot-storage', { method: 'GET' });
}

function writeBotStorage(storage) {
  return requestJson('/api/bot-storage', {
    method: 'POST',
    body: storage,
  });
}

function resetBotStorage() {
  return requestJson('/api/bot-storage/reset', { method: 'POST' });
}

function syncBotStorage() {
  return requestJson('/api/bot-storage/sync', { method: 'POST' });
}

module.exports = {
  getApiBaseUrl,
  getInternalApiAuthToken,
  readBotStorage,
  writeBotStorage,
  resetBotStorage,
  syncBotStorage,
  requestJson,
};
