require('../config/load-env').loadEnv();

const { createZaloBotClient } = require('../platforms/zalo/client');
const {
  createZaloPermissionPolicy,
} = require('../platforms/zalo/permission-policy');
const {
  createZaloCommandDefinitions,
} = require('../runtime/create-zalo-command-definitions');
const {
  createApiStateRepository,
} = require('../runtime/repositories/api-state-repository');
const { startZaloBotRuntime } = require('../runtime/start-zalo-bot');
const { logEvent } = require('./utils/logger');

function requireZaloToken(env = process.env) {
  const token = String(env.ZALO_BOT_TOKEN ?? '').trim();

  if (!token) {
    throw new Error('Missing ZALO_BOT_TOKEN.');
  }

  return token;
}

async function bootstrapZaloBot({
  env = process.env,
  client = createZaloBotClient({
    token: requireZaloToken(env),
    onError: error =>
      logEvent('zalo', 'polling error', { error: error.message }, 'error'),
  }),
  stateRepository = createApiStateRepository(),
  permissionPolicy = createZaloPermissionPolicy({ env }),
} = {}) {
  const botInfo = await client.getMe();
  const runtime = startZaloBotRuntime({
    client,
    stateRepository,
    permissionPolicy,
    definitions: createZaloCommandDefinitions(),
    onError: error =>
      logEvent('zalo', 'command error', { error: error.message }, 'error'),
  });

  client.startPolling();

  return Object.freeze({
    botInfo,
    client,
    runtime,
    async stop() {
      runtime.stop();
      await client.stopPolling();
    },
  });
}

async function runZaloBot() {
  logEvent('zalo', 'starting local polling adapter');
  const application = await bootstrapZaloBot();
  let stopping = false;

  logEvent(
    'zalo',
    'running',
    { bot: application.botInfo?.name || application.botInfo?.display_name },
    'success'
  );

  const stop = async signal => {
    if (stopping) return;
    stopping = true;
    logEvent('zalo', 'shutting down', { signal });

    try {
      await application.stop();
    } catch (error) {
      logEvent('zalo', 'shutdown failed', { error: error.message }, 'error');
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

if (require.main === module) {
  runZaloBot().catch(error => {
    logEvent('zalo', 'failed to start', { error: error.message }, 'error');
    process.exitCode = 1;
  });
}

module.exports = {
  bootstrapZaloBot,
  requireZaloToken,
  runZaloBot,
};
