const { createCommandRegistry } = require('../core/commands/command-registry');
const { createCommandRouter } = require('../core/commands/command-router');
const { createTelegramAdapter } = require('../platforms/telegram/adapter');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');

function startBotRuntime({
  bot,
  registry,
  definitions = [],
  stateRepository = createApiStateRepository(),
  permissionPolicy,
  telegramChannelConfig,
  registerTelegramActionHandler,
  onError,
} = {}) {
  const activeRegistry = registry || createCommandRegistry();

  definitions.forEach(definition => activeRegistry.register(definition));

  const router = createCommandRouter({
    registry: activeRegistry,
    stateRepository,
    permissionPolicy,
  });
  const adapter = createTelegramAdapter({
    bot,
    router,
    channelConfig: telegramChannelConfig,
    registerActionHandler: registerTelegramActionHandler,
    onError,
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
