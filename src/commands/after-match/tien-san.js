const { formatMoney } = require('../../utils/format');
const { sendMessage } = require('../../utils/chat');
const { TIEN_SAN } = require('../../utils/messages');

const bot = require('../../bot');

module.exports = (getTiensan, setTiensan) => {
  bot.onText(/^\/tiensan (.+)$/, (msg, match) => {
    const input = match[1].replace(/[^\d]/g, '');
    if (!input || isNaN(Number(input))) {
      sendMessage(msg, 'DEFAULT', TIEN_SAN.instruction);
      return;
    }
    const value = Number(input);
    setTiensan(value);
    sendMessage(
      msg,
      'ANNOUNCEMENT',
      TIEN_SAN.success.replace('{value}', formatMoney(value))
    );
  });

  bot.onText(/^\/tiensan$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      sendMessage(msg, 'DEFAULT', TIEN_SAN.noTiensan);
    } else {
      sendMessage(
        msg,
        'ANNOUNCEMENT',
        TIEN_SAN.success.replace('{value}', formatMoney(tiensan))
      );
    }
  });
};
