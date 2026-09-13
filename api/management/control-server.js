const http = require('node:http');
const { createManagementService } = require('./service');
const { handleManagementRequest } = require('./routes');
function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
  return true;
}
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536)
      throw Object.assign(new Error('REQUEST_TOO_LARGE'), {
        code: 'REQUEST_TOO_LARGE',
        status: 413,
      });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('INVALID_JSON'), {
      code: 'INVALID_JSON',
      status: 400,
    });
  }
}
function createManagementControlServer({
  env = process.env,
  service = createManagementService({ env }),
} = {}) {
  const handler = async (req, res) => {
    try {
      if (req.url === '/health' && req.method === 'GET')
        return sendJson(res, 200, { ok: true, service: 'management' });
      const handled = await handleManagementRequest(req, res, {
        service,
        env,
        readJson,
        sendJson,
      });
      if (!handled && !res.writableEnded)
        sendJson(res, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      if (!res.headersSent)
        sendJson(
          res,
          [400, 413, 503].includes(error.status) ? error.status : 503,
          {
            error:
              error.status === 413
                ? 'REQUEST_TOO_LARGE'
                : 'MANAGEMENT_UNAVAILABLE',
          }
        );
      else res.end();
    }
  };
  const server = http.createServer(handler);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    handler,
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(Number(env.MANAGEMENT_PORT || env.PORT || 8790), () =>
          resolve(server.address())
        );
      }),
    stop: async () => {
      await new Promise(resolve => server.close(resolve));
      await service.store?.close?.();
    },
  };
}
module.exports = { createManagementControlServer, readJson };
