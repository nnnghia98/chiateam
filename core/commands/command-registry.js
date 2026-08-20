const { createCommandDefinition } = require('../contracts/command-definition');
const { normalizeCommandName } = require('../contracts/command-context');

function createCommandRegistry(initialDefinitions = []) {
  const definitions = new Map();
  const names = new Map();

  function register(input) {
    const definition = createCommandDefinition(input);
    const commandNames = [definition.name, ...definition.aliases];

    commandNames.forEach(commandName => {
      if (names.has(commandName)) {
        throw new Error(`Command name is already registered: ${commandName}`);
      }
    });

    definitions.set(definition.name, definition);
    commandNames.forEach(commandName => names.set(commandName, definition));
    return definition;
  }

  function find(commandName) {
    try {
      return names.get(normalizeCommandName(commandName)) || null;
    } catch (error) {
      return null;
    }
  }

  function list() {
    return Array.from(definitions.values());
  }

  initialDefinitions.forEach(register);

  return Object.freeze({
    register,
    find,
    list,
  });
}

module.exports = {
  createCommandRegistry,
};
