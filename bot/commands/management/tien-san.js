const { formatMoney } = require('../../utils/format');
const { sendMessage } = require('../../utils/chat');
const { TIEN_SAN } = require('../../utils/messages');

const bot = require('../../telegram-client');

module.exports = (getTiensan, setTiensan) => {
  bot.onText(/^\/tiensan$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TIEN_SAN.empty,
      });
    } else {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TIEN_SAN.current.replace('{value}', formatMoney(tiensan)),
      });
    }
  });

  bot.onText(/^\/tiensan (.+)$/, (msg, match) => {
    const input = match[1].replace(/[^\d]/g, '');
    if (!input || isNaN(Number(input))) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TIEN_SAN.instruction,
      });
      return;
    }
    const value = Number(input);
    setTiensan(value);
    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message: TIEN_SAN.success.replace('{value}', formatMoney(value)),
    });
  });
};
