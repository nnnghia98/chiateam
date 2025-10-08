const { REGISTER } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');

const bot = require('../../bot');

const registerCommand = () => {
  bot.onText(/^\/register$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: REGISTER.instruction,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(/^\/register (.+)$/, (msg, info) => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: '✅ Đăng ký thành công',
    });

    console.log('info', info);
  });
};

module.exports = registerCommand;
