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
  });
  const adapter = createZaloAdapter({
    client,
    router,
    onPrivateMessage: subscriptionRepository?.refreshSubscriber,
    greetingRepository,
    onError,
    commandGate:
      commandGate ||
      createBotControlsGate({
        platform: 'zalo',
        client:
          botControlsClient ||
          createBotControlsClient({ platform: 'zalo', mode }),
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
