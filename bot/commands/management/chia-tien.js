const { formatMoney } = require('../../utils/format');
const { CHIA_TIEN } = require('../../utils/messages');
const { buildTwoTeamFeeMessage } = require('../../utils/two-team-fee');

const bot = require('../../telegram-client');
const { sendMessage } = require('../../utils/chat');

module.exports = (
  getTiensan,
  getTiennuoc,
  getTeamThua,
  { teamA, teamB, team3A = new Map(), team3B = new Map(), team3C = new Map() }
) => {
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
        message:
          team3A.size + team3B.size + team3C.size > 0
            ? CHIA_TIEN.threeTeamUnsupported
            : CHIA_TIEN.noMembers,
      });
      return;
    }

    const teamThua = getTeamThua();
    const message = buildTwoTeamFeeMessage({
      tiensan,
      tiennuoc: getTiennuoc(),
      teamThua,
      teamA,
      teamB,
    });

    if (message) {
      sendMessage({
        msg,
        type: 'ANNOUNCEMENT',
        message,
        options: { parse_mode: 'Markdown' },
      });
      return;
    }

    const perMember = Math.ceil(tiensan / totalMembers);

    // Simple split - everyone pays the same
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
