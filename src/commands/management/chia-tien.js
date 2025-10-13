const { formatMoney } = require('../../utils/format');
const { CHIA_TIEN } = require('../../utils/messages');

const bot = require('../../bot');
const { sendMessage } = require('../../utils/chat');

module.exports = (getTiensan, { teamA, teamB }) => {
  bot.onText(/^\/chiatien$/, msg => {
    const tiensan = getTiensan();
    if (!tiensan) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CHIA_TIEN.instruction,
      });
      return;
    }

    const totalMembers = teamA.size + teamB.size;
    if (totalMembers === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: CHIA_TIEN.noMembers,
      });
      return;
    }

    const perMember = Math.ceil(tiensan / totalMembers);
    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message: CHIA_TIEN.totalMembers
        .replace('{tiensan}', formatMoney(tiensan))
        .replace('{totalMembers}', totalMembers)
        .replace('{perMember}', formatMoney(perMember)),
    });
  });
};
