import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createMessengerWebhookApplication,
} = require('../runtime/create-messenger-webhook-application');
const { verifyMessengerWebhook } = require('../platforms/messenger/webhook');

let application;

function getApplication() {
  if (!application) {
    application = createMessengerWebhookApplication();
  }

  return application;
}

function responseHeaders(headers = {}) {
  return {
    'Cache-Control': 'no-store',
    ...headers,
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: responseHeaders(headers),
  });
}

function textResponse(body, status = 200, headers = {}) {
  return new Response(String(body ?? ''), {
    status,
    headers: responseHeaders({
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    }),
  });
}

export function createGetHandler({
  getVerifyToken = () => process.env.MESSENGER_VERIFY_TOKEN,
  logError = error =>
    console.error('❌ [messenger.webhook]', error?.message || String(error)),
} = {}) {
  return function GET(request) {
    try {
      const url = new URL(request.url);
      const result = verifyMessengerWebhook({
        mode: url.searchParams.get('hub.mode'),
        verifyToken: url.searchParams.get('hub.verify_token'),
        challenge: url.searchParams.get('hub.challenge'),
        expectedToken: getVerifyToken(),
      });

      return textResponse(result.body, result.statusCode, result.headers);
    } catch (error) {
      logError(error);
      return textResponse('Internal Server Error', 500);
    }
  };
}

export function createPostHandler({
  resolveApplication = getApplication,
  logError = error =>
    console.error('❌ [messenger.webhook]', error?.message || String(error)),
} = {}) {
  return async function POST(request) {
    try {
      const rawBody = Buffer.from(await request.arrayBuffer());
      const result = await resolveApplication().handleWebhook({
        headers: request.headers,
        body: rawBody.toString('utf8'),
        rawBody,
      });

      return jsonResponse(result.body, result.statusCode, result.headers);
    } catch (error) {
      logError(error);
      return jsonResponse({ ok: false }, 500);
    }
  };
}

export const GET = createGetHandler();
export const POST = createPostHandler();
