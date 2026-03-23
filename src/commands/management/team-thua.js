const { formatMoney } = require('../../utils/format');
const { getDisplayName } = require('../../utils/team-member');
const { sendMessage } = require('../../utils/chat');
const { TEAM_THUA } = require('../../utils/messages');

const bot = require('../../bot');

module.exports = (getTiensan, getTiennuoc, getTeamThua, setTeamThua, { teamA, teamB }) => {
  bot.onText(/^\/teamthua (HOME|AWAY)$/i, (msg, match) => {
    const team = match[1].toUpperCase();
    setTeamThua(team);

    const tiensan = getTiensan();
    const tiennuoc = getTiennuoc();
    const totalMembers = teamA.size + teamB.size;

    if (!tiensan || totalMembers === 0) {
      sendMessage({
        msg,
        type: 'ANNOUNCEMENT',
        message: TEAM_THUA.success.replace('{team}', team),
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    const loserTeam = team === 'HOME' ? teamA : teamB;
    const winnerTeam = team === 'HOME' ? teamB : teamA;
    const loserName = team === 'HOME' ? 'HOME' : 'AWAY';
    const winnerName = team === 'HOME' ? 'AWAY' : 'HOME';

    const perMember = Math.ceil(tiensan / totalMembers);
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
      `*${loserName}:* ${formatMoney(perMember)} + ${formatMoney(waterPerLoser)}=${formatMoney(loserTotal)}`;

    sendMessage({
      msg,
      type: 'ANNOUNCEMENT',
      message,
      options: { parse_mode: 'Markdown' },
    });
  });

  bot.onText(/^\/teamthua$/, msg => {
    const teamThua = getTeamThua();
    if (!teamThua) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TEAM_THUA.noTeamThua,
        options: { parse_mode: 'Markdown' },
      });
    } else {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TEAM_THUA.current.replace('{team}', teamThua),
        options: { parse_mode: 'Markdown' },
      });
    }
  });
};
