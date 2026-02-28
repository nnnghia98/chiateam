const { sendMessage } = require('../../utils/chat');
const { MATCHES } = require('../../utils/messages');
const { listMatches } = require('../../api/matches');

const bot = require('../../bot');

function formatDateDisplay(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function matchesCommand() {
  bot.onText(/^\/matches(?:\s+(\d+))?$/, async (msg, match) => {
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

      let message = '📅 *Danh sách trận đấu* 📅\n\n';

      matches.forEach(m => {
        const dateLabel = formatDateDisplay(m.match_date);
        const score =
          m.home_score != null && m.away_score != null
            ? ` ${m.home_score} - ${m.away_score}`
            : '';
        message += `• ${dateLabel}${score}\n`;
      });

      message += `\n💡 Dùng \`/match dd/mm/yyyy\` để xem chi tiết`;

      sendMessage({
        msg,
        type: 'DEFAULT',
        message,
        options: { parse_mode: 'Markdown' },
      });
    } catch (err) {
      console.error('Error listing matches:', err);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: '❌ Có lỗi xảy ra khi tải danh sách trận đấu. Vui lòng thử lại.',
      });
    }
  });
}

module.exports = matchesCommand;
