const { formatMoney } = require('../../utils/format');
const { sendMessage } = require('../../utils/chat');
const { TIEN_NUOC } = require('../../utils/messages');

const bot = require('../../bot');

module.exports = (getTiennuoc, setTiennuoc) => {
  bot.onText(/^\/tiennuoc (.+)$/, (msg, match) => {
    const input = match[1].replace(/[^\d]/g, '');
    if (!input || isNaN(Number(input))) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TIEN_NUOC.instruction,
      });
      return;
    }
    const value = Number(input);
    setTiennuoc(value);
    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message: TIEN_NUOC.success.replace('{value}', formatMoney(value)),
    });
  });

  bot.onText(/^\/tiennuoc$/, msg => {
    const tiennuoc = getTiennuoc();
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: TIEN_NUOC.current.replace('{value}', formatMoney(tiennuoc)),
    });
  });
};
