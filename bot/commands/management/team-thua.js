const { sendMessage } = require('../../utils/chat');
const { TEAM_THUA } = require('../../utils/messages');
const { buildTwoTeamFeeMessage } = require('../../utils/two-team-fee');

const bot = require('../../telegram-client');

function getWinner(teamThua) {
  return teamThua === 'HOME' ? 'AWAY' : 'HOME';
}

function getLoserFromWinner(teamThang) {
  return teamThang === 'HOME' ? 'AWAY' : 'HOME';
}

function registerTeamResultCommand({
  getTiensan,
  getTiennuoc,
  getTeamThua,
  setTeamThua,
  teamA,
  teamB,
  team3A = new Map(),
  team3B = new Map(),
  team3C = new Map(),
}) {
  const announceResult = (msg, teamThua, label) => {
    const hasTwoTeamMembers = teamA.size + teamB.size > 0;
    const hasThreeTeamMembers = team3A.size + team3B.size + team3C.size > 0;

    if (!hasTwoTeamMembers && hasThreeTeamMembers) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TEAM_THUA.threeTeamUnsupported,
      });
      return;
    }

    setTeamThua(teamThua);

    const message =
      getTiensan() && hasTwoTeamMembers
        ? buildTwoTeamFeeMessage({
            tiensan: getTiensan(),
            tiennuoc: getTiennuoc(),
            teamThua,
            teamA,
            teamB,
          })
        : null;

    sendMessage({
      msg,
      type: message ? 'ANNOUNCEMENT' : 'DEFAULT',
      message:
        message ||
        (label === 'winner'
          ? TEAM_THUA.winnerSuccess.replace('{team}', getWinner(teamThua))
          : TEAM_THUA.success.replace('{team}', teamThua)),
      options: message ? { parse_mode: 'Markdown' } : undefined,
    });
  };

  // Preferred command: choose the winning team.
  bot.onText(/^\/teamthang\s+(HOME|AWAY)$/i, (msg, match) => {
    const teamThang = match[1].toUpperCase();
    announceResult(msg, getLoserFromWinner(teamThang), 'winner');
  });

  bot.onText(/^\/teamthang$/, msg => {
    const teamThua = getTeamThua();
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: teamThua
        ? TEAM_THUA.winnerCurrent.replace('{team}', getWinner(teamThua))
        : TEAM_THUA.noWinner,
      options: { parse_mode: 'Markdown' },
    });
  });

  // Compatibility command: older usage selected the losing team directly.
  bot.onText(/^\/teamthua\s+(HOME|AWAY)$/i, (msg, match) => {
    announceResult(msg, match[1].toUpperCase(), 'loser');
  });

  bot.onText(/^\/teamthua$/, msg => {
    const teamThua = getTeamThua();
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: teamThua
        ? TEAM_THUA.current.replace('{team}', teamThua)
        : TEAM_THUA.noTeamThua,
      options: { parse_mode: 'Markdown' },
    });
  });
}

module.exports = registerTeamResultCommand;
module.exports.getLoserFromWinner = getLoserFromWinner;
