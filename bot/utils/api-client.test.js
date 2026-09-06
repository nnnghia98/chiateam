const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { requestJson } = require('./api-client');

test('internal API client bounds stalled requests and rejects interrupted responses', async t => {
  const previous = {
    BOT_API_BASE_URL: process.env.BOT_API_BASE_URL,
    INTERNAL_API_AUTH_TOKEN: process.env.INTERNAL_API_AUTH_TOKEN,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const server = http.createServer((req, res) => {
    assert.equal(req.headers['x-internal-api-auth'], 'test-internal-token');
    if (req.url === '/stall') return;
    if (req.url === '/interrupt') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"unfinished":');
      setImmediate(() => res.destroy());
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  t.after(
    () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      })
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  process.env.BOT_API_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.INTERNAL_API_AUTH_TOKEN = 'test-internal-token';

  assert.deepEqual(await requestJson('/ok'), { ok: true });
  assert.deepEqual(await requestJson('/ok', { timeoutMs: 1000 }), { ok: true });
  await assert.rejects(requestJson('/stall', { timeoutMs: 30 }), {
    code: 'API_TIMEOUT',
  });
  await assert.rejects(
    requestJson('/interrupt', { timeoutMs: 1000 }),
    /interrupted|aborted|socket hang up/
  );
});
