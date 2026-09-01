const ZALO_MESSAGE_MAX_LENGTH = 2000;

function escapeZaloMarkdown(text) {
  return String(text).replace(/([\\`*_~#>+\-{}])/g, '\\$1');
}

function formatActionFallbacks(actions) {
  if (actions.length === 0) {
    return '';
  }

  const lines = actions.map((action, index) => {
    const command = action.command ? ` — ${action.command}` : '';
    return `${index + 1}. ${action.label}${command}`;
  });

  return `\n\n${lines.join('\n')}`;
}

function formatZaloMessage(message) {
  const useMarkdown = message.segments.length > 0 || message.actions.length > 0;
  let text = message.text;

  if (message.segments.length > 0) {
    text = message.segments
      .map(segment => {
        const escaped = escapeZaloMarkdown(segment.text);
        return segment.bold ? `**${escaped}**` : escaped;
      })
      .join('');
  } else if (useMarkdown) {
    text = escapeZaloMarkdown(text);
  }

  text += useMarkdown
    ? escapeZaloMarkdown(formatActionFallbacks(message.actions))
    : formatActionFallbacks(message.actions);

  return {
    text,
    options: useMarkdown ? { parse_mode: 'markdown' } : {},
  };
}

function splitZaloText(text, maxLength = ZALO_MESSAGE_MAX_LENGTH) {
  const value = String(text ?? '');

  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new TypeError('Zalo message limit must be a positive integer.');
  }

  if (value.length <= maxLength) {
    return value ? [value] : [];
  }

  const chunks = [];
  let remaining = value;

  while (remaining.length > maxLength) {
    let breakAt = remaining.lastIndexOf('\n', maxLength);

    if (breakAt <= 0) {
      breakAt = remaining.lastIndexOf(' ', maxLength);
    }

    if (breakAt <= 0) {
      breakAt = maxLength;
    } else {
      breakAt += 1;
    }

    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

module.exports = {
  ZALO_MESSAGE_MAX_LENGTH,
  escapeZaloMarkdown,
  formatActionFallbacks,
  formatZaloMessage,
  splitZaloText,
};
