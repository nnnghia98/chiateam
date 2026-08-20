function requireText(value, field) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new TypeError(`${field} is required.`);
  }

  return text;
}

function requireContent(value, field) {
  const text = String(value ?? '');

  if (text.length === 0) {
    throw new TypeError(`${field} is required.`);
  }

  return text;
}

function normalizeAction(action, index) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new TypeError(`messages.actions[${index}] must be an object.`);
  }

  const normalized = {
    id: requireText(action.id, `messages.actions[${index}].id`),
    label: requireText(action.label, `messages.actions[${index}].label`),
  };

  if (action.command != null) {
    normalized.command = requireText(
      action.command,
      `messages.actions[${index}].command`
    );
  }

  return Object.freeze(normalized);
}

function normalizeInput(input, index) {
  if (input == null) {
    return null;
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`messages[${index}].input must be an object.`);
  }

  const command = requireText(input.command, `messages[${index}].input.command`)
    .replace(/^\//, '')
    .toLowerCase();

  if (!/^[a-z0-9_-]+$/.test(command)) {
    throw new TypeError(`messages[${index}].input.command is invalid.`);
  }

  const args = Array.isArray(input.args) ? input.args : [];

  return Object.freeze({
    command,
    args: Object.freeze(
      args.map((arg, argIndex) =>
        requireText(arg, `messages[${index}].input.args[${argIndex}]`)
      )
    ),
  });
}

function normalizeSegment(segment, index) {
  if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
    throw new TypeError(`messages.segments[${index}] must be an object.`);
  }

  return Object.freeze({
    text: requireContent(segment.text, `messages.segments[${index}].text`),
    bold: segment.bold === true,
  });
}

function normalizeMessage(message, index) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new TypeError(`messages[${index}] must be an object.`);
  }

  const actions = Array.isArray(message.actions) ? message.actions : [];
  const segments = Array.isArray(message.segments) ? message.segments : [];
  const normalizedSegments = segments.map(normalizeSegment);
  const fallbackText =
    normalizedSegments.length > 0
      ? normalizedSegments.map(segment => segment.text).join('')
      : message.text;
  let channel = 'source';

  if (message.channel != null) {
    channel = requireText(
      message.channel,
      `messages[${index}].channel`
    ).toLowerCase();
  }

  return Object.freeze({
    text: requireText(fallbackText, `messages[${index}].text`),
    actions: Object.freeze(actions.map(normalizeAction)),
    segments: Object.freeze(normalizedSegments),
    channel,
    input: normalizeInput(message.input, index),
  });
}

function createCommandResult(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('command result must be an object.');
  }

  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new TypeError('command result must contain at least one message.');
  }

  return Object.freeze({
    messages: Object.freeze(input.messages.map(normalizeMessage)),
  });
}

function createTextResult(
  text,
  actions = [],
  { channel = 'source', input = null } = {}
) {
  return createCommandResult({
    messages: [{ text, actions, channel, input }],
  });
}

function createRichTextResult(
  segments,
  actions = [],
  { channel = 'source', input = null } = {}
) {
  return createCommandResult({
    messages: [{ segments, actions, channel, input }],
  });
}

module.exports = {
  createCommandResult,
  createRichTextResult,
  createTextResult,
};
