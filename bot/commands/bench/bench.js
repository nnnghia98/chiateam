const { getDisplayName } = require('../../utils/team-member');
const { BENCH } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../telegram-client');

const benchCommand = ({ members, refreshFromSource }) => {
  bot.onText(/^\/bench$/, async msg => {
    if (typeof refreshFromSource === 'function') {
      try {
        await refreshFromSource();
      } catch (error) {
        console.error('❌ [bench] Failed to refresh bot storage from API:', error);
        await sendMessage({
          msg,
          type: 'DEFAULT',
          message: BENCH.refreshError,
        });
        return;
      }
    }

    if (members.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: BENCH.emptyBench,
      });
      return;
    }
    const names = Array.from(members.values()).map(getDisplayName);

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: BENCH.success.replace('{names}', names.join('\n')),
    });
  });
};

module.exports = benchCommand;
