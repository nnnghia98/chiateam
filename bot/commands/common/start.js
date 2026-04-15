const { START } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const bot = require('../../telegram-client');

const startCommand = () => {
  bot.onText(/^\/start$/, msg => {
    sendMessage({
      msg,
      type: 'MAIN',
      message: START.help,
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = startCommand;
