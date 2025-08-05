const VALIDATION = {
  onlyAdmin: '⛔ Chỉ admin mới có quyền.',
};

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

const ADD_TO_TEAM = {
  emptyList: '⚠️ Danh sách trống. Thêm member trước.',
  usage:
    '📋 *Danh sách member hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/addtoteam{team} 1,3,5` - Chọn member số 1, 3, 5\n• `/addtoteam{team} 1-3` - Chọn member từ 1 đến 3\n• `/addtoteam{team} all` - Chọn tất cả',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/addtoteam{team} 1,3,5` hoặc `/addtoteam{team} 1-3` hoặc `/addtoteam{team} all`',
  success:
    '✅ Đã thêm {count} member(s) vào {team}:\n{selectedNames}\n\n👤 *{team} hiện tại:*\n{teamMembers}',
};

const LIST = {
  emptyList: '⚠️ List trống.',
  success: '👥 Danh sách hiện tại:\n{names}',
};

const REMOVE = {
  emptyList: '⚠️ List trống.',
  usage:
    '📋 *Danh sách member hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/remove 1,3,5` - Xóa member số 1, 3, 5\n• `/remove 1-3` - Xóa member từ 1 đến 3\n• `/remove all` - Xóa tất cả (Admin only)',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/remove 1,3,5` hoặc `/remove 1-3` hoặc `/remove all`',
  success: '✅ Đã xóa {count} member(s):\n{removedNames}',
  noRemovedMembers: '⚠️ Không có member nào bị xóa.',
};

const RESET = {
  emptyList: '📝 /list trống',
  success: '✅ /list đã được xóa',
};

const RESET_TEAM = {
  emptyList: '📝 Không có team nào để xóa.',
  success: '✅ Đã xóa toàn bộ team và chuyển member về danh sách chính.',
};

const RESET_TEAM_INDIVIDUAL = {
  emptyTeam: '⚠️ {team} trống.',
  usage:
    '👤 *{team} hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/resetteam{teamNum} 1,3,5` - Reset member số 1, 3, 5 về list\n• `/resetteam{teamNum} 1-3` - Reset member từ 1 đến 3 về list\n• `/resetteam{teamNum} all` - Reset tất cả member về list\n• `/resetteam{teamNum} "John"` - Reset member theo tên',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/resetteam{teamNum} 1,3,5` hoặc `/resetteam{teamNum} 1-3` hoặc `/resetteam{teamNum} all` hoặc `/resetteam{teamNum} "John"`',
  noResetMembers: '⚠️ Không có member nào được reset.',
  success: '✅ Đã reset {count} member(s) từ {team} về list:\n{resetNames}',
};

module.exports = {
  VALIDATION,
  ADD,
  ADD_ME,
  ADD_TO_TEAM,
  LIST,
  REMOVE,
  RESET,
  RESET_TEAM,
  RESET_TEAM_INDIVIDUAL,
};
