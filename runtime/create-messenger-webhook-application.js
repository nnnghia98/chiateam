const { createMessengerBotClient } = require('../platforms/messenger/client');
const {
  createMessengerPermissionPolicy,
} = require('../platforms/messenger/permission-policy');
const {
  createMessengerWebhookHandler,
} = require('../platforms/messenger/webhook');
const {
  createMessengerCommandDefinitions,
} = require('./create-messenger-command-definitions');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');
const {
  createApiWebhookEventRepository,
} = require('./repositories/api-webhook-event-repository');
const { startMessengerBotRuntime } = require('./start-messenger-bot');

function requireEnvironmentValue(env, name) {
  const value = String(env?.[name] ?? '').trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function createMessengerWebhookApplication({
  env = process.env,
  client,
  stateRepository,
  eventRepository,
  permissionPolicy,
  definitions = createMessengerCommandDefinitions(),
  appSecret,
  onError = error => console.error('❌ [messenger.webhook.command]', error),
} = {}) {
  const activeClient =
    client ||
    createMessengerBotClient({
      pageId: requireEnvironmentValue(env, 'MESSENGER_PAGE_ID'),
      pageAccessToken: requireEnvironmentValue(
        env,
        'MESSENGER_PAGE_ACCESS_TOKEN'
      ),
      graphApiVersion: env.MESSENGER_GRAPH_API_VERSION,
      onError,
    });
  const runtime = startMessengerBotRuntime({
    client: activeClient,
    stateRepository: stateRepository || createApiStateRepository(),
    permissionPolicy:
      permissionPolicy || createMessengerPermissionPolicy({ env }),
    definitions,
    listenForClientEvents: false,
    onError,
  });
  const handleWebhook = createMessengerWebhookHandler({
    adapter: runtime.adapter,
    appSecret:
      appSecret || requireEnvironmentValue(env, 'MESSENGER_APP_SECRET'),
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
  createMessengerWebhookApplication,
  requireEnvironmentValue,
};
