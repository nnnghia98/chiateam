function action(command, args = []) {
  return Object.freeze({ command, args: Object.freeze([...args]) });
}

const REPLY_KEYBOARD_ACTIONS = Object.freeze({
  '🗳️ Vote ngay': action('vote'),
  '📋 Bench': action('bench'),
  '👤 Thêm người': action('add'),
  '✏️ Sửa bench': action('editbench'),
  '🗑️ Xoá khỏi bench': action('clearbench'),
  '🎲 Chia team': action('chiateam'),
  '⚽ Team': action('team'),
  '👥➕ Thêm vào team': action('addtoteam'),
  '🗑️ Xoá khỏi team': action('clearteam'),
  '🗳️ Tạo vote': action('taovote'),
  '📊 Kết quả vote': action('demvote'),
  '🔄 Đồng bộ bench': action('sync'),
  '📣 Gửi Zalo': action('zalosay'),
});

function createReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '🗳️ Vote ngay' }, { text: '🗳️ Tạo vote' }],
      [{ text: '📋 Bench' }, { text: '✏️ Sửa bench' }],
      [{ text: '🗑️ Xoá khỏi bench' }, { text: '👤 Thêm người' }],
      [{ text: '🎲 Chia team' }, { text: '⚽ Team' }],
      [{ text: '👥➕ Thêm vào team' }, { text: '🗑️ Xoá khỏi team' }],
      [{ text: '📊 Kết quả vote' }, { text: '🔄 Đồng bộ bench' }],
      [{ text: '📣 Gửi Zalo' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: false,
  };
}

function getReplyKeyboardAction(text) {
  if (typeof text !== 'string') return null;
  const label = text.trim();
  return Object.prototype.hasOwnProperty.call(REPLY_KEYBOARD_ACTIONS, label)
    ? REPLY_KEYBOARD_ACTIONS[label]
    : null;
}

module.exports = {
  createReplyKeyboard,
  getReplyKeyboardAction,
};
