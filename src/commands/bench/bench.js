const { BENCH } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const benchCommand = ({ members }) => {
  bot.onText(/^\/bench$/, msg => {
    if (members.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: BENCH.emptyBench,
      });
      return;
    }
    const names = Array.from(members.values());

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: BENCH.success.replace('{names}', names.join('\n')),
    });
  });
};

module.exports = benchCommand;
