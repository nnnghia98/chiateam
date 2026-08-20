const { normalizeCommandName } = require('./command-context');

const VALID_PERMISSIONS = new Set(['player', 'admin', 'system']);

function normalizePermission(value, field) {
  const permission = String(value ?? '')
    .trim()
    .toLowerCase();

  if (!VALID_PERMISSIONS.has(permission)) {
    throw new TypeError(`${field} is not supported.`);
  }

  return permission;
}

function requireFunction(value, field) {
  if (typeof value !== 'function') {
    throw new TypeError(`${field} must be a function.`);
  }

  return value;
}

function requireInstruction(instruction) {
  if (!instruction || typeof instruction !== 'object') {
    throw new TypeError('instruction is required.');
  }

  const usage = String(instruction.usage ?? '').trim();
  const description = String(instruction.description ?? '').trim();
  const permission = normalizePermission(
    instruction.permission,
    'instruction permission'
  );

  if (!usage || !description) {
    throw new TypeError('instruction usage and description are required.');
  }

  return Object.freeze({ usage, description, permission });
}

function createPermissionResolver(resolver, defaultPermission) {
  if (resolver == null) {
    return () => defaultPermission;
  }

  requireFunction(resolver, 'resolvePermission');

  return async context =>
    normalizePermission(await resolver(context), 'resolved command permission');
}

function normalizeStateKeys(keys) {
  if (!Array.isArray(keys)) {
    throw new TypeError('resolved command state keys must be an array.');
  }

  return Object.freeze([
    ...new Set(keys.map(value => String(value).trim()).filter(Boolean)),
  ]);
}

function createStateKeysResolver(resolver, defaultStateKeys) {
  if (resolver == null) {
    return () => defaultStateKeys;
  }

  requireFunction(resolver, 'resolveStateKeys');

  return async context => normalizeStateKeys(await resolver(context));
}

function createCommandDefinition(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('command definition must be an object.');
  }

  const name = normalizeCommandName(input.name);
  const aliases = Array.isArray(input.aliases)
    ? input.aliases.map(normalizeCommandName)
    : [];
  const stateKeys = normalizeStateKeys(
    Array.isArray(input.stateKeys) ? input.stateKeys : []
  );
  const commandNames = [name, ...aliases];
  const instruction = requireInstruction(input.instruction);

  if (new Set(commandNames).size !== commandNames.length) {
    throw new TypeError('command name and aliases must be unique.');
  }

  return Object.freeze({
    name,
    aliases: Object.freeze(aliases),
    instruction,
    resolvePermission: createPermissionResolver(
      input.resolvePermission,
      instruction.permission
    ),
    stateKeys,
    resolveStateKeys: createStateKeysResolver(
      input.resolveStateKeys,
      stateKeys
    ),
    condition: requireFunction(input.condition, 'condition'),
    action: requireFunction(input.action, 'action'),
    reply: requireFunction(input.reply, 'reply'),
  });
}

module.exports = {
  createCommandDefinition,
  VALID_PERMISSIONS,
};
