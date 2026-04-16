const { sendMessage } = require('../../utils/chat');
const { isOnCooldown } = require('../../utils/cooldown');
const { MATCHES } = require('../../utils/messages');
const { listMatches } = require('../../../api/routes/matches');

const bot = require('../../telegram-client');

function formatDateDisplay(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function matchesCommand() {
  bot.onText(/^\/matches(?:\s+(\d+))?$/, async (msg, match) => {
    if (isOnCooldown(msg, '/matches')) {
      return;
    }

    const limit = match[1] ? Math.min(parseInt(match[1], 10) || 10, 20) : 10;

    try {
      const matches = await listMatches(limit, 0);

      if (matches.length === 0) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: MATCHES.empty,
        });
        return;
      }

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MATCHES.buildList(
          matches.map(match => {
            const dateLabel = formatDateDisplay(match.match_date);
            const score =
              match.home_score != null && match.away_score != null
                ? ` ${match.home_score} - ${match.away_score}`
                : '';
            return `• ${dateLabel}${score}`;
          })
        ),
        options: { parse_mode: 'Markdown' },
      });
    } catch (err) {
      console.error('Error listing matches:', err);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: MATCHES.error,
      });
    }
  });
}

module.exports = matchesCommand;
