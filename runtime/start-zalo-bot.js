const { createCommandRegistry } = require('../core/commands/command-registry');
const { createCommandRouter } = require('../core/commands/command-router');
const { createZaloAdapter } = require('../platforms/zalo/adapter');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');

function startZaloBotRuntime({
  client,
  registry,
  definitions = [],
  stateRepository = createApiStateRepository(),
  permissionPolicy,
  listenForClientEvents = true,
  onError,
} = {}) {
  if (typeof listenForClientEvents !== 'boolean') {
    throw new TypeError('Zalo runtime listener flag must be a boolean.');
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
    onError,
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
