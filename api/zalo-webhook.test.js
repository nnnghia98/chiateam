const test = require('node:test');
const assert = require('node:assert/strict');

test('Vercel Zalo entry maps webhook results to HTTP responses', async () => {
  const { GET, createPostHandler } = await import('./zalo-webhook.mjs');
  const requests = [];
  const POST = createPostHandler({
    resolveApplication: () => ({
      async handleWebhook(request) {
        requests.push(request);
        return {
          statusCode: 503,
          headers: { 'Retry-After': '2' },
          body: { ok: false },
        };
      },
    }),
  });
  const request = new Request('https://example.com/webhook/zalo', {
    method: 'POST',
    headers: { 'X-Bot-Api-Secret-Token': 'secret-123' },
    body: '{"ok":true}',
  });
  const response = await POST(request);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '2');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(requests[0].body, '{"ok":true}');

  const health = GET();
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: 'zalo-webhook',
  });
});

test('Vercel Zalo entry hides internal errors', async () => {
  const { createPostHandler } = await import('./zalo-webhook.mjs');
  const errors = [];
  const POST = createPostHandler({
    resolveApplication: () => {
      throw new Error('private failure');
    },
    logError: error => errors.push(error.message),
  });
  const response = await POST(
    new Request('https://example.com/webhook/zalo', {
      method: 'POST',
      body: '{}',
    })
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false });
  assert.deepEqual(errors, ['private failure']);
});
