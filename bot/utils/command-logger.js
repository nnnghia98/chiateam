function getTelegramDisplayName(from) {
  if (!from) return 'Unknown User';
  return from.first_name || from.username || 'Unknown User';
}

/**
 * Logs which Telegram user used which command and when.
 * Intended for server logs (stdout).
 */
function logCommandUsage(msg) {
  if (!msg || !msg.text || typeof msg.text !== 'string') return;
  if (!msg.text.startsWith('/')) return;

  const tele_id = msg.from?.id ?? null;
  const tele_name = getTelegramDisplayName(msg.from);
  const command_exact = msg.text;
  const command = command_exact.split(/\s+/)[0];

  // Telegram `msg.date` is seconds since epoch (UTC). Fallback to now.
  const usedAt = new Date((msg.date ? msg.date * 1000 : Date.now()));

  const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
  const vnTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(usedAt);

  // Human-friendly multi-line log (easy to visually scan).
  // Keep it consistent and grep-able via the prefix.
  console.log(
    [
      '[telegram_command]',
      `time       : ${vnTime}`,
      `timezone   : ${VN_TIME_ZONE} (GMT+7)`,
      'location   : Vietnam (Ho Chi Minh City)',
      `tele_id    : ${tele_id}`,
      `tele_name  : ${tele_name}`,
      `command    : ${command}`,
      `exact      : ${command_exact}`,
    ].join('\n')
  );
}

module.exports = {
  logCommandUsage,
};

