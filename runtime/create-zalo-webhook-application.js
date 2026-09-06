const { createZaloBotClient } = require('../platforms/zalo/client');
const {
  createZaloPermissionPolicy,
} = require('../platforms/zalo/permission-policy');
const { createZaloWebhookHandler } = require('../platforms/zalo/webhook');
const {
  createZaloCommandDefinitions,
} = require('./create-zalo-command-definitions');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');
const {
  createApiWebhookEventRepository,
} = require('./repositories/api-webhook-event-repository');
const { startZaloBotRuntime } = require('./start-zalo-bot');

function requireEnvironmentValue(env, name) {
  const value = String(env?.[name] ?? '').trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function createZaloWebhookApplication({
  env = process.env,
  client,
  stateRepository,
  eventRepository,
  permissionPolicy,
  definitions,
  subscriptionRepository,
  secretToken,
  onError = error => console.error('❌ [zalo.webhook.command]', error),
} = {}) {
  const activeClient =
    client ||
    createZaloBotClient({
      token: requireEnvironmentValue(env, 'ZALO_BOT_TOKEN'),
      onError,
    });
  const runtime = startZaloBotRuntime({
    client: activeClient,
    stateRepository: stateRepository || createApiStateRepository(),
    permissionPolicy: permissionPolicy || createZaloPermissionPolicy({ env }),
    definitions:
      definitions || createZaloCommandDefinitions({ subscriptionRepository }),
    listenForClientEvents: false,
    onError,
  });
  const handleWebhook = createZaloWebhookHandler({
    adapter: runtime.adapter,
    secretToken:
      secretToken || requireEnvironmentValue(env, 'ZALO_WEBHOOK_SECRET'),
    eventRepository: eventRepository || createApiWebhookEventRepository(),
  });

  return Object.freeze({
    client: activeClient,
    runtime,
    handleWebhook,
    stop: () => runtime.stop(),
  });
}

module.exports = {
  createZaloWebhookApplication,
  requireEnvironmentValue,
};
