import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createZaloWebhookApplication,
  createManagedWebhookApplication,
} = require('../runtime/create-zalo-webhook-application');
const { createManagedRuntimeClient } = require('../runtime/managed-runtime-client');

require('../config/load-env').loadEnv();
const runtimeClient = createManagedRuntimeClient({ service: 'zalo-webhook' });
const managed = createManagedWebhookApplication({
  getSnapshot: () => runtimeClient.getSettings(),
  report: payload => runtimeClient.report(payload),
  lease: (instanceId, action) => runtimeClient.lease(instanceId, action),
});

let legacy;
function getApplication() {
  if (process.env.MANAGEMENT_BOOTSTRAP === 'true' || process.env.MANAGEMENT_BOOTSTRAP === '1') return managed;
  return legacy ||= createZaloWebhookApplication();
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
    console.error('Zalo webhook request failed'),
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
