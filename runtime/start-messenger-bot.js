const { createCommandRegistry } = require('../core/commands/command-registry');
const { createCommandRouter } = require('../core/commands/command-router');
const { createMessengerAdapter } = require('../platforms/messenger/adapter');
const {
  createApiStateRepository,
} = require('./repositories/api-state-repository');

function startMessengerBotRuntime({
  client,
  registry,
  definitions = [],
  stateRepository = createApiStateRepository(),
  permissionPolicy,
  listenForClientEvents = true,
  onError,
} = {}) {
  if (typeof listenForClientEvents !== 'boolean') {
    throw new TypeError('Messenger runtime listener flag must be a boolean.');
  }

  const activeRegistry = registry || createCommandRegistry();

  definitions.forEach(definition => activeRegistry.register(definition));

  const router = createCommandRouter({
    registry: activeRegistry,
    stateRepository,
    permissionPolicy,
  });
  const adapter = createMessengerAdapter({
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
  startMessengerBotRuntime,
};
