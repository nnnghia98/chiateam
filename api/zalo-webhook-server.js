require('../config/load-env').loadEnv();
const http = require('node:http');
async function createZaloWebhookServer({ env = process.env, handler } = {}) {
  const post = handler || (await import('./zalo-webhook.mjs')).POST;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://webhook.local');
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }
      if (req.method !== 'POST' || url.pathname !== '/webhook/zalo') {
        res.writeHead(404);
        res.end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1048576) {
          res.writeHead(413);
          res.end();
          return;
        }
        chunks.push(chunk);
      }
      const response = await post(
        new Request(url, {
          method: 'POST',
          headers: req.headers,
          body: Buffer.concat(chunks),
        })
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!res.headersSent) res.writeHead(503, { 'Cache-Control': 'no-store' });
      res.end();
    }
  });
  server.requestTimeout = 15000;
  return {
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(Number(env.ZALO_WEBHOOK_PORT || env.PORT || 8791), () =>
          resolve(server.address())
        );
      }),
    stop: () => new Promise(resolve => server.close(resolve)),
  };
}
if (require.main === module)
  createZaloWebhookServer()
    .then(async app => {
      await app.start();
      const stop = () => void app.stop();
      process.once('SIGTERM', stop);
      process.once('SIGINT', stop);
      console.log('Zalo webhook server ready');
    })
    .catch(() => {
      console.error('Zalo webhook server failed');
      process.exitCode = 1;
    });
module.exports = { createZaloWebhookServer };
