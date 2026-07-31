const { formatMoney } = require('../../utils/format');
const { sendMessage } = require('../../utils/chat');
const { TIEN_NUOC } = require('../../utils/messages');

const bot = require('../../telegram-client');

module.exports = (getTiennuoc, setTiennuoc) => {
  bot.onText(/^\/tiennuoc(?:\s+(.+))?$/, (msg, match) => {
    const rawInput = match[1]?.trim();

    if (!rawInput) {
      const tiennuoc = getTiennuoc();
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: tiennuoc
          ? TIEN_NUOC.current.replace('{value}', formatMoney(tiennuoc))
          : TIEN_NUOC.empty,
      });
      return;
    }

    const input = rawInput.replace(/[^\d]/g, '');
    if (!input || Number.isNaN(Number(input))) {
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
};
