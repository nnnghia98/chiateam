import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createZaloWebhookApplication,
} = require('../runtime/create-zalo-webhook-application');

let application;

function getApplication() {
  if (!application) {
    application = createZaloWebhookApplication();
  }

  return application;
}

function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function GET() {
  return jsonResponse({ ok: true, service: 'zalo-webhook' });
}

export function createPostHandler({
  resolveApplication = getApplication,
  logError = error =>
    console.error('❌ [zalo.webhook]', error?.message || String(error)),
} = {}) {
  return async function POST(request) {
    try {
      const result = await resolveApplication().handleWebhook({
        headers: request.headers,
        body: await request.text(),
      });

      return jsonResponse(result.body, result.statusCode, result.headers);
    } catch (error) {
      logError(error);
      return jsonResponse({ ok: false }, 500);
    }
  };
}

export const POST = createPostHandler();
