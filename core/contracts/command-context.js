function requireText(value, field) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new TypeError(`${field} is required.`);
  }

  return text;
}

function optionalText(value) {
  if (value == null || value === '') {
    return null;
  }

  return String(value);
}

function normalizeCommandName(value) {
  const token = requireText(value, 'command')
    .replace(/^\//, '')
    .split('@')[0]
    .toLowerCase();

  if (!/^[a-z0-9_-]+$/.test(token)) {
    throw new TypeError('command contains unsupported characters.');
  }

  return token;
}

function createCommandContext(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('command context must be an object.');
  }

  if (!Array.isArray(input.args)) {
    throw new TypeError('args must be an array.');
  }

  const actorInput = input.actor || {};
  const conversationInput = input.conversation || {};
  const actor = Object.freeze({
    platform: requireText(actorInput.platform, 'actor.platform').toLowerCase(),
    externalId: requireText(actorInput.externalId, 'actor.externalId'),
    displayName: optionalText(actorInput.displayName),
    username: optionalText(actorInput.username),
  });
  const conversation = Object.freeze({
    externalId: requireText(
      conversationInput.externalId,
      'conversation.externalId'
    ),
    threadId: optionalText(conversationInput.threadId),
  });

  return Object.freeze({
    command: normalizeCommandName(input.command),
    args: Object.freeze(input.args.map(value => String(value))),
    actor,
    conversation,
  });
}

module.exports = {
  createCommandContext,
  normalizeCommandName,
};
