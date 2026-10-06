const { createCommandRegistry } = require('../core/commands/command-registry');
const { createCommandRouter } = require('../core/commands/command-router');
const { createZaloAdapter } = require('../platforms/zalo/adapter');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');
const {
  createBotControlsClient,
  createBotControlsGate,
} = require('./bot-controls');

function startZaloBotRuntime({
  client,
  env = process.env,
  registry,
  definitions = [],
  stateRepository = createApiStateRepository(),
  permissionPolicy,
  subscriptionRepository,
  greetingRepository,
  listenForClientEvents = true,
  mode = listenForClientEvents ? 'polling' : 'webhook',
  commandGate,
  botControlsClient,
  onError,
} = {}) {
  if (typeof listenForClientEvents !== 'boolean') {
    throw new TypeError('Zalo runtime listener flag must be a boolean.');
  }
  if (!['polling', 'webhook'].includes(mode)) {
    throw new TypeError('Zalo runtime mode must be polling or webhook.');
  }

  const activeRegistry = registry || createCommandRegistry();

  definitions.forEach(definition => activeRegistry.register(definition));

  const router = createCommandRouter({
    registry: activeRegistry,
    stateRepository,
    permissionPolicy,
    commandRules:
      require('../core/commands/managed-command-rules').createManagedCommandRules(
        env
      ),
  });
  const adapter = createZaloAdapter({
    client,
    router,
    onPrivateMessage: subscriptionRepository?.refreshSubscriber,
    greetingRepository,
    greetingEnabled:
      env.ZALO_GREETING_ENABLED !== 'false' &&
      env.ZALO_GREETING_ENABLED !== false,
    greetingResult: actor =>
      require('../platforms/zalo/responses').createZaloGreetingResult(
        actor,
        env
      ),
    onError,
    commandGate:
      commandGate ||
      createBotControlsGate({
        platform: 'zalo',
        client:
          botControlsClient ||
          createBotControlsClient({ platform: 'zalo', mode, env }),
      }),
  });

  if (listenForClientEvents) {
    adapter.start();
  }

  return Object.freeze({
    registry: activeRegistry,
    router,
    stateRepository,
    adapter,
    stop: () => adapter.stop(),
  });
}

module.exports = {
  startZaloBotRuntime,
};
