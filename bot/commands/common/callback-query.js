const bot = require('../../telegram-client');
const { logEvent } = require('../../utils/logger');
const { CALLBACK_QUERY } = require('../../utils/messages');

const callbackQueryHandlers = [];

function registerCallbackQueryHandler(handler) {
  callbackQueryHandlers.push(handler);
}

function logUnsupportedCallback(query) {
  logEvent('telegram.callback', 'unsupported inline button', {
    data: query.data,
    user: `${query.from?.first_name || query.from?.username || 'Unknown'} (${query.from?.id || '-'})`,
    chat: query.message?.chat?.id,
    message: query.message?.message_id,
    callback: query.id,
  }, 'warn');
}

function handleUnsupportedCallback(query) {
  logUnsupportedCallback(query);

  return bot.answerCallbackQuery(query.id, {
    text: CALLBACK_QUERY.unsupported,
    show_alert: false,
  });
}

function callbackQueryCommand() {
  bot.on('callback_query', async query => {
    try {
      for (const handler of callbackQueryHandlers) {
        const handled = await handler(query);
        if (handled) {
          return;
        }
      }

      await handleUnsupportedCallback(query);
    } catch (error) {
      logEvent('telegram.callback', 'failed to answer callback', {
        error: error.message,
        callback: query.id,
        data: query.data,
      }, 'error');
    }
  });
}

module.exports = callbackQueryCommand;
module.exports.handleUnsupportedCallback = handleUnsupportedCallback;
module.exports.registerCallbackQueryHandler = registerCallbackQueryHandler;
