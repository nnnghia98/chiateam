const { getChatId } = require('../../utils/chat');
const { formatMoney } = require('../../utils/format');
const { CHIA_TIEN } = require('../../utils/messages');

module.exports = (bot, getTiensan, teamA, teamB) => {
  bot.onText(/^\/chiatien$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), CHIA_TIEN.instruction);
      return;
    }
    const totalMembers = teamA.size + teamB.size;
    if (totalMembers === 0) {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), CHIA_TIEN.noMembers);
      return;
    }
    const perMember = Math.ceil(tiensan / totalMembers);
    bot.sendMessage(
      getChatId(msg, 'ANNOUNCEMENT'),
      CHIA_TIEN.totalMembers
        .replace('{tiensan}', formatMoney(tiensan))
        .replace('{totalMembers}', totalMembers)
        .replace('{perMember}', formatMoney(perMember))
    );
  });
};
