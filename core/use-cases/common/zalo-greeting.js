const { createTextResult } = require('../../contracts/command-result');

function buildZaloGreeting(actor, env = process.env) {
  const rawName =
    typeof actor?.displayName === 'string' ? actor.displayName : '';
  const name = rawName
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim()
    .slice(0, 100);
  const configured = typeof env.ZALO_GREETING_TEXT === 'string' ? env.ZALO_GREETING_TEXT.trim().slice(0, 1000) : '';
  return configured ? configured.replaceAll('{name}', name || 'bạn') : `👋 Chào ${name || 'bạn'}! Đây là bot ChiaTeam.`;
}

function createZaloGreetingResult(actor, env = process.env) {
  return createTextResult(
    `${buildZaloGreeting(actor, env)}\n\n` +
      '🔔 /subscribe — Nhận thông báo của đội\n' +
      '🗳️ /poll — Xem vote đang mở\n' +
      '⚽ /team — Xem đội hình\n' +
      '📚 /start — Xem tất cả lệnh'
  );
}

module.exports = { buildZaloGreeting, createZaloGreetingResult };
