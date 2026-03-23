const { formatMoney } = require('../../utils/format');
const { getDisplayName } = require('../../utils/team-member');
const { CHIA_TIEN } = require('../../utils/messages');

const bot = require('../../bot');
const { sendMessage } = require('../../utils/chat');

module.exports = (getTiensan, getTiennuoc, getTeamThua, { teamA, teamB }) => {
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

    const tiennuoc = getTiennuoc();
    const teamThua = getTeamThua();
    const perMember = Math.ceil(tiensan / totalMembers);

    // No losing team selected → simple split
    if (!teamThua) {
      sendMessage({
        msg,
        type: 'ANNOUNCEMENT',
        message: CHIA_TIEN.totalMembers
          .replace('{tiensan}', formatMoney(tiensan))
          .replace('{totalMembers}', totalMembers)
          .replace('{perMember}', formatMoney(perMember)),
      });
      return;
    }

    // Determine winner/loser teams
    const loserTeam = teamThua === 'HOME' ? teamA : teamB;
    const winnerTeam = teamThua === 'HOME' ? teamB : teamA;
    const loserName = teamThua === 'HOME' ? 'HOME' : 'AWAY';
    const winnerName = teamThua === 'HOME' ? 'AWAY' : 'HOME';

    const loserCount = loserTeam.size;
    const waterPerLoser = loserCount > 0 ? Math.ceil(tiennuoc / loserCount) : 0;
    const loserTotal = perMember + waterPerLoser;
    const winnerTotal = perMember;

    const loserMembers = Array.from(loserTeam.values()).map(getDisplayName).join('\n');
    const winnerMembers = Array.from(winnerTeam.values()).map(getDisplayName).join('\n');

    const message =
      `💸 *Tổng tiền: ${formatMoney(tiensan)} VND*\n` +
      `👥 Số người: ${totalMembers}\n\n` +
      `Mỗi người phải trả: ${formatMoney(perMember)} VND\n` +
      `Tiền nước: ${formatMoney(tiennuoc)}/${loserCount}=${formatMoney(waterPerLoser)}\n\n` +
      `*${winnerName}:*\n${winnerMembers}\n\n` +
      `*${loserName}:*\n${loserMembers}\n\n` +
      `=> \n` +
      `*${winnerName}:* ${formatMoney(winnerTotal)}\n` +
      `*${loserName}:* ${formatMoney(perMember)} + ${formatMoney(waterPerLoser)}=${formatMoney(loserTotal)}\n\n` +
      `0000000000 Momo, zalopay, shopeefood, lazada, tiki, ...\n` +
      `0000000000 Techcombank`;

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });
};
