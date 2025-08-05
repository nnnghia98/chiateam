const { formatMoney } = require('../../utils/format');

const sanStrings = new Map();

function getOpts(msg) {
  return msg.message_thread_id
    ? { message_thread_id: msg.message_thread_id }
    : {};
}

module.exports = (bot, getTiensan, setTiensan) => {
  bot.onText(/\/tiensan (.+)/, (msg, match) => {
    const input = match[1].replace(/[^\d]/g, '');
    if (!input || isNaN(Number(input))) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Vui lòng nhập số tiền hợp lệ. Ví dụ: /tiensan 1000000',
        getOpts(msg)
      );
      return;
    }
    const value = Number(input);
    setTiensan(value);
    bot.sendMessage(
      msg.chat.id,
      `✅ Đã thêm tiền sân: ${formatMoney(value)} VND`,
      getOpts(msg)
    );
  });

  bot.onText(/\/tiensan$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      bot.sendMessage(msg.chat.id, 'Chưa thêm tiền sân', getOpts(msg));
    } else {
      bot.sendMessage(msg.chat.id, `${formatMoney(tiensan)} VND`, getOpts(msg));
    }
  });

  // /san [string]: set once, then just show
  bot.onText(/\/san(?:\s+(.+))?/, (msg, match) => {
    const currentSan = sanStrings.get(msg.chat.id);
    const input = match[1] && match[1].trim();
    if (input) {
      if (currentSan) {
        bot.sendMessage(msg.chat.id, `Sân: ${currentSan}`, getOpts(msg));
      } else {
        sanStrings.set(msg.chat.id, input);
        bot.sendMessage(msg.chat.id, `✅ Đã lưu sân: ${input}`, getOpts(msg));
      }
    } else {
      if (currentSan) {
        bot.sendMessage(msg.chat.id, `Sân: ${currentSan}`, getOpts(msg));
      } else {
        bot.sendMessage(
          msg.chat.id,
          'Chưa lưu sân nào. Dùng /san [tên sân] để lưu.',
          getOpts(msg)
        );
      }
    }
  });

  // /clearsan: remove the string
  bot.onText(/\/clearsan/, msg => {
    if (sanStrings.has(msg.chat.id)) {
      sanStrings.delete(msg.chat.id);
      bot.sendMessage(msg.chat.id, '✅ Đã xóa sân.', getOpts(msg));
    } else {
      bot.sendMessage(msg.chat.id, 'Không có sân nào để xóa.', getOpts(msg));
    }
  });
};
