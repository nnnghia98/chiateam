const { getDisplayName } = require('../../utils/team-member');
const { TEAM } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { escapeMarkdown } = require('../../utils/format');

const bot = require('../../telegram-client');

const teamsCommand = ({ teamA, teamB, team3A, team3B, team3C }) => {
  // Show 2-team view (HOME / AWAY)
  bot.onText(/^\/team$/, msg => {
    if (teamA.size === 0 && teamB.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TEAM.noTeam,
      });
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: TEAM.buildTwoTeamMessage(
        Array.from(teamA.values()).map(v => escapeMarkdown(getDisplayName(v))),
        Array.from(teamB.values()).map(v => escapeMarkdown(getDisplayName(v)))
      ),
      options: { parse_mode: 'Markdown' },
    });
  });

  // Show 3-team view (HOME / AWAY / EXTRA)
  bot.onText(/^\/team 3$/, msg => {
    if (team3A.size === 0 && team3B.size === 0 && team3C.size === 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: TEAM.noTeam3,
      });
      return;
    }

    sendMessage({
      msg,
      type: 'DEFAULT',
      message: TEAM.buildThreeTeamMessage(
        Array.from(team3A.values()).map(v => escapeMarkdown(getDisplayName(v))),
        Array.from(team3B.values()).map(v => escapeMarkdown(getDisplayName(v))),
        Array.from(team3C.values()).map(v => escapeMarkdown(getDisplayName(v)))
      ),
      options: { parse_mode: 'Markdown' },
    });
  });
};

module.exports = teamsCommand;
