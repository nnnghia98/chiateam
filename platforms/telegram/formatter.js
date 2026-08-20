function escapeMarkdownV2(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

const TELEGRAM_COMMAND_ACTION_PREFIX = 'core:cmd:';

function getCallbackData(action) {
  const callbackData = action.command
    ? `${TELEGRAM_COMMAND_ACTION_PREFIX}${action.command}`
    : action.id;

  if (Buffer.byteLength(callbackData, 'utf8') > 64) {
    throw new RangeError('Telegram callback data must not exceed 64 bytes.');
  }

  return callbackData;
}

function formatTelegramMessage(message) {
  const options = {};
  let text = message.text;

  if (message.segments.length > 0) {
    text = message.segments
      .map(segment => {
        const escaped = escapeMarkdownV2(segment.text);
        return segment.bold ? `*${escaped}*` : escaped;
      })
      .join('');
    options.parse_mode = 'MarkdownV2';
  }

  if (message.actions.length > 0) {
    options.reply_markup = {
      inline_keyboard: message.actions.map(action => [
        {
          text: action.label,
          callback_data: getCallbackData(action),
        },
      ]),
    };
  }

  return {
    text,
    options,
  };
}

module.exports = {
  TELEGRAM_COMMAND_ACTION_PREFIX,
  escapeMarkdownV2,
  formatTelegramMessage,
  getCallbackData,
};
