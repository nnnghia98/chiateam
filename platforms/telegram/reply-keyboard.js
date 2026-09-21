const REPLY_KEYBOARD_COMMANDS = Object.freeze({
  '➕ Vote +1': '/vote +1',
  '📋 Bench': '/bench',
  '👤 Thêm cầu ngoài': '/add',
  '✏️ Sửa bench': '/editbench',
  '🗑️ Xoá khỏi bench': '/clearbench',
  '🎲 Chia team': '/chiateam',
  '⚽ Team': '/team',
  '👥➕ Thêm vào team': '/addtoteam',
  '🗑️ Xoá khỏi team': '/clearteam',
  '🗳️ Tạo vote': '/taovote',
  '📊 Kết quả vote': '/demvote',
  '🔄 Đồng bộ bench': '/sync',
  '📖 Hướng dẫn': '/start',
});

function createReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '➕ Vote +1' }, { text: '📋 Bench' }],
      [{ text: '👤 Thêm cầu ngoài' }, { text: '✏️ Sửa bench' }],
      [{ text: '🗑️ Xoá khỏi bench' }, { text: '🎲 Chia team' }],
      [{ text: '⚽ Team' }, { text: '👥➕ Thêm vào team' }],
      [{ text: '🗑️ Xoá khỏi team' }, { text: '🗳️ Tạo vote' }],
      [{ text: '📊 Kết quả vote' }, { text: '🔄 Đồng bộ bench' }],
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
