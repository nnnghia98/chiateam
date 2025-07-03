const { formatMoney } = require('../utils/format');

module.exports = (bot, getTiensan, teamA, teamB) => {
  bot.onText(/\/chiatien$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      bot.sendMessage(
        msg.chat.id,
        '💸 Bạn chưa thêm tiền sân. Dùng /tiensan [số tiền] trước.'
      );
      return;
    }
    const totalMembers = teamA.size + teamB.size;
    if (totalMembers === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Không có thành viên nào trong team để chia tiền.'
      );
      return;
    }
    const perMember = Math.ceil(tiensan / totalMembers);
    bot.sendMessage(
      msg.chat.id,
      `💸 Tổng tiền: ${formatMoney(tiensan)} VND\n👥 Số người: ${totalMembers}\n\nMỗi người phải trả: ${formatMoney(perMember)} VND`
    );
  });
};
