const { createTextResult } = require('../../contracts/command-result');

function buildZaloGreeting(actor) {
  const rawName =
    typeof actor?.displayName === 'string' ? actor.displayName : '';
  const name = rawName
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim()
    .slice(0, 100);
  return `👋 Chào ${name || 'bạn'}! Đây là bot ChiaTeam.`;
}

function createZaloGreetingResult(actor) {
  return createTextResult(
    `${buildZaloGreeting(actor)}\n\n` +
      '/subscribe — Nhận thông báo của đội\n' +
      '/poll — Xem vote đang mở\n' +
      '/team — Xem đội hình\n' +
      '/start — Xem tất cả lệnh'
  );
}

module.exports = { buildZaloGreeting, createZaloGreetingResult };
