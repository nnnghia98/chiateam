const test = require('node:test');
const assert = require('node:assert/strict');

test('Vercel Messenger GET verifies the Meta callback challenge', async () => {
  const { createGetHandler } = await import('./messenger-webhook.mjs');
  const GET = createGetHandler({ getVerifyToken: () => 'verify-123' });
  const valid = GET(
    new Request(
      'https://example.com/webhook/messenger?hub.mode=subscribe&hub.verify_token=verify-123&hub.challenge=challenge-1'
    )
  );
  const invalid = GET(
    new Request(
      'https://example.com/webhook/messenger?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-1'
    )
  );

  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(valid.headers.get('cache-control'), 'no-store');
  assert.equal(await valid.text(), 'challenge-1');
  assert.equal(invalid.status, 403);
});

test('Vercel Messenger POST preserves raw bytes and maps webhook results', async () => {
  const { createPostHandler } = await import('./messenger-webhook.mjs');
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
  const body = '{"object":"page"}';
  const response = await POST(
    new Request('https://example.com/webhook/messenger', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': 'sha256=test' },
      body,
    })
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '2');
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(requests[0].body, body);
  assert.equal(Buffer.isBuffer(requests[0].rawBody), true);
  assert.equal(requests[0].rawBody.toString('utf8'), body);
});

test('Vercel Messenger entry hides internal errors', async () => {
  const { createPostHandler } = await import('./messenger-webhook.mjs');
  const errors = [];
  const POST = createPostHandler({
    resolveApplication: () => {
      throw new Error('private failure');
    },
    logError: error => errors.push(error.message),
  });
  const response = await POST(
    new Request('https://example.com/webhook/messenger', {
      method: 'POST',
      body: '{}',
    })
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false });
  assert.deepEqual(errors, ['private failure']);
});
