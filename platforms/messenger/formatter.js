const MESSENGER_MESSAGE_MAX_LENGTH = 2000;

function formatActionFallbacks(actions) {
  if (!actions || actions.length === 0) return '';

  return `\n\n${actions
    .map((action, index) => {
      const command = action.command ? ` — ${action.command}` : '';
      return `${index + 1}. ${action.label}${command}`;
    })
    .join('\n')}`;
}

function formatMessengerMessage(message = {}) {
  const segments = Array.isArray(message.segments) ? message.segments : [];
  const text =
    segments.length > 0
      ? segments.map(segment => String(segment?.text ?? '')).join('')
      : String(message.text ?? '');

  return {
    text: text + formatActionFallbacks(message.actions || []),
    options: {},
  };
}

function splitMessengerText(text, maxLength = MESSENGER_MESSAGE_MAX_LENGTH) {
  const value = String(text ?? '');

  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new TypeError('Messenger message limit must be a positive integer.');
  }

  if (value.length <= maxLength) return value ? [value] : [];

  const chunks = [];
  let remaining = value;

  while (remaining.length > maxLength) {
    let breakAt = remaining.lastIndexOf('\n', maxLength);
    if (breakAt <= 0) breakAt = remaining.lastIndexOf(' ', maxLength);
    if (breakAt <= 0) breakAt = maxLength;
    else breakAt += 1;
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

module.exports = {
  MESSENGER_MESSAGE_MAX_LENGTH,
  formatActionFallbacks,
  formatMessengerMessage,
  splitMessengerText,
};
