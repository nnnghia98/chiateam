const { createCommandRegistry } = require('../core/commands/command-registry');
const { createCommandRouter } = require('../core/commands/command-router');
const {
  createManagedCommandRules,
} = require('../core/commands/managed-command-rules');
const { createTelegramAdapter } = require('../platforms/telegram/adapter');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');
const {
  createBotControlsClient,
  createBotControlsGate,
} = require('./bot-controls');

function startBotRuntime({
  bot,
  env = process.env,
  registry,
  definitions = [],
  stateRepository = createApiStateRepository(),
  permissionPolicy,
  telegramChannelConfig,
  registerTelegramActionHandler,
  commandGate,
  botControlsClient,
  allowedSlashCommands,
  onError,
} = {}) {
  const activeRegistry = registry || createCommandRegistry();

  definitions.forEach(definition => activeRegistry.register(definition));

  const router = createCommandRouter({
    registry: activeRegistry,
    stateRepository,
    permissionPolicy,
    commandRules: createManagedCommandRules(env),
  });
  const adapter = createTelegramAdapter({
    bot,
    router,
    channelConfig: telegramChannelConfig,
    registerActionHandler: registerTelegramActionHandler,
    onError,
    commandGate:
      commandGate ||
      createBotControlsGate({
        platform: 'telegram',
        client:
          botControlsClient ||
          createBotControlsClient({
            platform: 'telegram',
            mode: 'polling',
            env,
          }),
      }),
    allowedSlashCommands,
  });

  adapter.start();

  return Object.freeze({
    registry: activeRegistry,
    router,
    stateRepository,
    adapter,
    stop: () => adapter.stop(),
  });
}

module.exports = {
  startBotRuntime,
};
