const ADD = {
  instruction: `📋 *Cách sử dụng /add:*
• \`/add [name 1, name 2, name 3, ...]\` - Thêm nhiều member vào list cùng lúc

Ví dụ: \`/add [Nghia, Nghia 1, Nghia 2]\``,
  warning:
    '⚠️ Nhập list member để thêm. Ví dụ:\n`/add [Nghia, Nghia 1, Nghia 2]`',
  invalidNames: '⚠️ Các tên không hợp lệ (bị bỏ qua): ',
  success: '✅ Đã thêm ${addedCount} member(s) vào /list',
  noNewMembers:
    '⚠️ Không có member mới được thêm. Tất cả member đã có trong /list',
};

const ADD_ME = {
  warning: '⚠️ Tên không hợp lệ.',
  duplicate: '⚠️ Đã có tên ${name} trong list.',
  success: '✅ ${name} đã được thêm vào /list',
};

module.exports = {
  ADD,
  ADD_ME,
};
