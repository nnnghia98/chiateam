const { formatMoney } = require('../../utils/format');
const { getChatId } = require('../../utils/chat');

const { TIEN_SAN } = require('../../utils/messages');

module.exports = (bot, getTiensan, setTiensan) => {
  bot.onText(/^\/tiensan (.+)$/, (msg, match) => {
    const input = match[1].replace(/[^\d]/g, '');
    if (!input || isNaN(Number(input))) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), TIEN_SAN.instruction);
      return;
    }
    const value = Number(input);
    setTiensan(value);
    bot.sendMessage(
      getChatId(msg, 'ANNOUNCEMENT'),
      TIEN_SAN.success.replace('{value}', formatMoney(value))
    );
  });

  bot.onText(/^\/tiensan$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), TIEN_SAN.noTiensan);
    } else {
      bot.sendMessage(
        getChatId(msg, 'ANNOUNCEMENT'),
        TIEN_SAN.success.replace('{value}', formatMoney(tiensan))
      );
    }
  });
};
