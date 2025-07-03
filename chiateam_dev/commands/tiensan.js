const { formatMoney } = require('../utils/format');

module.exports = (bot, getTiensan, setTiensan) => {
  bot.onText(/\/tiensan (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].replace(/[^\d]/g, '');
    if (!input || isNaN(Number(input))) {
      bot.sendMessage(
        chatId,
        '⚠️ Vui lòng nhập số tiền hợp lệ. Ví dụ: /tiensan 1000000'
      );
      return;
    }
    const value = Number(input);
    setTiensan(value);
    bot.sendMessage(chatId, `✅ Đã thêm tiền sân: ${formatMoney(value)} VND`);
  });

  bot.onText(/\/tiensan$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      bot.sendMessage(msg.chat.id, 'Chưa thêm tiền sân');
    } else {
      bot.sendMessage(msg.chat.id, `${formatMoney(tiensan)} VND`);
    }
  });
};
