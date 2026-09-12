const REPLY_KEYBOARD_COMMANDS = Object.freeze({
  '➕ Tham gia': '/addme',
  '📋 Bench': '/bench',
  '⚽ Team': '/team',
  '🗳️ Kết quả vote': '/demvote',
  '👤 Thông tin của tôi': '/me',
  '📅 Lịch sử trận': '/matches',
  '📖 Hướng dẫn': '/start',
});

function createReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '➕ Tham gia' }, { text: '📋 Bench' }],
      [{ text: '⚽ Team' }, { text: '🗳️ Kết quả vote' }],
      [{ text: '👤 Thông tin của tôi' }, { text: '📅 Lịch sử trận' }],
      [{ text: '📖 Hướng dẫn' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: false,
  };
}

function getReplyKeyboardCommand(text) {
  if (typeof text !== 'string') return null;
  const label = text.trim();
  return Object.prototype.hasOwnProperty.call(REPLY_KEYBOARD_COMMANDS, label)
    ? REPLY_KEYBOARD_COMMANDS[label]
    : null;
}

module.exports = {
  createReplyKeyboard,
  getReplyKeyboardCommand,
};
