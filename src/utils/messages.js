const VALIDATION = {
  onlyAdmin: '⛔ Chỉ admin mới có quyền.',
};

const ADD = {
  instruction: `📋 *Cách sử dụng /add:*
• \`/add name 1, name 2, name 3, ...\` - Thêm nhiều member vào bench cùng lúc

Ví dụ: \`/add Nghia, Nghia 1, Nghia 2\``,
  warning:
    '⚠️ Nhập tên member để thêm vào bench. Ví dụ:\n`/add Nghia, Nghia 1, Nghia 2`',
  invalidNames: '⚠️ Các tên không hợp lệ (bị bỏ qua): ',
  success: '✅ Đã thêm ${addedCount} member(s) vào /bench',
  noNewMembers:
    '⚠️ Không có member mới được thêm. Tất cả member đã có trong /bench',
};

const ADD_ME = {
  warning: '⚠️ Tên không hợp lệ.',
  duplicate: '⚠️ Đã có tên ${name} trong bench.',
  success: '✅ ${name} lên bench!',
};

const ADD_TO_TEAM = {
  emptyBench: '⚠️ Bench trống. Thêm member trước.',
  instruction:
    '📋 *Bench hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/addtoteam{team} 1,3,5` - Chọn member số 1, 3, 5\n• `/addtoteam{team} 1-3` - Chọn member từ 1 đến 3\n• `/addtoteam{team} all` - Chọn tất cả',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/addtoteam{team} 1,3,5` hoặc `/addtoteam{team} 1-3` hoặc `/addtoteam{team} all`',
  success:
    '✅ Đã thêm {count} member(s) vào {team}:\n{selectedNames}\n\n👤 *{team} hiện tại:*\n{teamMembers}',
};

const BENCH = {
  emptyBench: '⚠️ Bench trống.',
  success: '👥 Danh sách hiện tại:\n{names}',
};

const REMOVE = {};

const CLEAR_BENCH = {
  emptyBench: '⚠️ Bench trống.',
  instruction:
    '📋 *Bench hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/clearbench 1,3,5` - Xóa member số 1, 3, 5\n• `/clearbench 1-3` - Xóa member từ 1 đến 3\n• `/clearbench all` - Xóa tất cả (Admin only)',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/clearbench 1,3,5` hoặc `/clearbench 1-3` hoặc `/clearbench all`',
  success: '✅ Đã xóa {count} member(s):\n{removedNames}',
  clearAllSuccess: '✅ Đã xóa toàn bộ member khỏi bench.',
  noRemovedMembers: '⚠️ Không có member nào bị xóa.',
};

const CLEAR_TEAM = {
  emptyTeam: '⚠️ Chưa chia team.',
  success: '✅ Đã xóa toàn bộ team và chuyển member về bench.',
};

const CLEAR_TEAM_INDIVIDUAL = {
  emptyTeam: '⚠️ Chưa chia team.',
  instruction:
    '👤 *{team} hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/clearteam{teamNum} 1,3,5` - Reset member số 1, 3, 5 về bench\n• `/clearteam{teamNum} 1-3` - Reset member từ 1 đến 3 về bench\n• `/clearteam{teamNum} all` - Reset tất cả member về bench\n• `/clearteam{teamNum} "John"` - Reset member theo tên',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/clearteam{teamNum} 1,3,5` hoặc `/clearteam{teamNum} 1-3` hoặc `/clearteam{teamNum} all` hoặc `/clearteam{teamNum} "John"`',
  noResetMembers: '⚠️ Không có member nào được reset.',
  success: '✅ Đã chuyển {count} member(s) từ {team} về bench:\n{resetNames}',
};

const UNKNOWN = {
  warning:
    '❓ Lệnh này hiện chưa được hỗ trợ.\n\nSử dụng `/start` để xem các lệnh khả dụng.',
};

const CHIA_TIEN = {
  instruction: '💸 Bạn chưa thêm tiền sân. Dùng /tiensan [số tiền] trước.',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  totalMembers:
    '💸 Tổng tiền: {tiensan} VND\n👥 Số người: {totalMembers}\n\nMỗi người phải trả: {perMember} VND',
};

const TIEN_SAN = {
  instruction: '⚠️ Vui lòng nhập số tiền hợp lệ. Ví dụ: /tiensan 1000000',
  noTiensan: '⚠️ Chưa thêm tiền sân.',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  success: '✅ Đã thêm tiền sân: {value} VND',
};

const SAN = {
  noSan: '⚠️ Chưa lưu sân nào. Dùng /san [tên sân] để lưu.',
  currentSan: 'Sân: {value}',
  successSan: '✅ Đã lưu sân: {value}',
  successDeleteSan: '✅ Đã xóa sân.',
};

const TAO_VOTE = {
  instruction:
    '📊 *Cách sử dụng /taovote:*\n' +
    '• `/taovote [question]` - Tạo vote với câu hỏi và 4 lựa chọn cố định (0, +1, +2, +3, +4)\n' +
    '• `/clearvote` - Xóa tất cả vote đang hoạt động\n' +
    '\nVí dụ: `/taovote Sân XX ngày YY giờ ZZ`\n' +
    '\n*Lưu ý:* Vote sẽ có 4 lựa chọn: 0, +1, +2, +3, +4',
  shortInstruction:
    '⚠️ Cần nhập câu hỏi cho vote.\n' +
    'Ví dụ: `/taovote Sân XX ngày YY giờ ZZ`',
  voteExists:
    '⚠️ Hiện tại đã có một vote đang hoạt động. Hãy xoá vote cũ trước khi tạo vote mới bằng lệnh /clearvote.',
  explanation: 'Vote được tạo bởi',
  error: '❌ Có lỗi xảy ra khi tạo vote. Vui lòng thử lại.',
  noVote: '📭 Không có vote nào đang hoạt động để xóa.',
  result: '📊 *Kết quả vote hiện tại:*\n*${question}*\n\n',
};

const REGISTER = {
  instruction: `📋 *Cách sử dụng /register:*
• /register [NUMBER] - Đăng ký với số áo

Tên và userId sẽ được lấy mặc định từ tài khoản Telegram của bạn.

Ví dụ: /register 10`,
  warning:
    '⚠️ Cần ít nhất 2 tham số: NUMBER và NAME.\n\nVí dụ: `/register 10 Nghia`',
  invalidNumber:
    '⚠️ Số áo phải là số nguyên dương hợp lệ.\n\nVí dụ: `/register 10 Nghia`',
  invalidName:
    '⚠️ Tên không hợp lệ. Tên chỉ được chứa chữ cái, số và khoảng trắng.\n\nVí dụ: `/register 10 Nghia`',
  duplicateNumber: '⚠️ Số áo ${number} đã được sử dụng bởi ${name}.',
  duplicateUserId:
    '⚠️ Người dùng với ID ${teleId} đã được đăng ký với tên ${name} và số áo ${number}.',
  success: `✅ *Đăng ký thành công!*

👤 **Thông tin cầu thủ:**
• **Tên:** \${name}
• **Số áo:** \${number}
• **Telegram ID:** \${teleId}
• **Username:** \${username}

🎯 Bây giờ bạn có thể sử dụng các lệnh:
• \`/leaderboard\` - Xem bảng xếp hạng
• \`/player\` - Xem thông số chi tiết
• \`/update-leaderboard\` - Cập nhật thống kê`,
  error: '❌ Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.',
};

const UPDATE_LEADERBOARD = {
  invalidSyntax:
    '❌ **Cú pháp không đúng!**\n\n📝 **Cách sử dụng:**\n`/update-leaderboard WIN [id1,id2,id3]`\n`/update-leaderboard LOSE [id1,id2,id3]`\n`/update-leaderboard DRAW [id1,id2,id3]`\n`/update-leaderboard GOAL player_number value`\n`/update-leaderboard ASSIST player_number value`\n\n**Ví dụ:**\n`/update-leaderboard WIN [10,17,7]`\n`/update-leaderboard LOSE [20,19]`\n`/update-leaderboard DRAW [8,9]`\n`/update-leaderboard GOAL 10 1`\n`/update-leaderboard ASSIST 10 +1`',
  invalidGoalAssistSyntax:
    '❌ **Cú pháp không đúng cho {result}!**\n\n📝 **Cách sử dụng:**\n`/update-leaderboard {result} player_number value`\n\n**Ví dụ:**\n`/update-leaderboard {result} 10 1`\n`/update-leaderboard {result} 10 +1`\n`/update-leaderboard {result} 10 -1`',
  invalidPlayerNumber:
    '❌ **Số người chơi không hợp lệ!**\n\n📝 **Lưu ý:** Số người chơi phải là số nguyên dương',
  invalidValue:
    '❌ **Giá trị không hợp lệ!**\n\n📝 **Lưu ý:** Giá trị phải là số nguyên (có thể âm hoặc dương)',
  invalidResult:
    '❌ **Kết quả không hợp lệ!**\n\n📝 **Chỉ chấp nhận:**\n• `WIN` - Cập nhật thắng\n• `LOSE` - Cập nhật thua\n• `DRAW` - Cập nhật hòa\n• `GOAL` - Cập nhật bàn thắng\n• `ASSIST` - Cập nhật kiến tạo\n\n📝 **Ví dụ đúng:**\n`/update-leaderboard WIN [10,17,7]`\n`/update-leaderboard LOSE [20,19]`\n`/update-leaderboard DRAW [8,9]`\n`/update-leaderboard GOAL 10 1`\n`/update-leaderboard ASSIST 10 +1`',
  noValidPlayerIds:
    '❌ **Không tìm thấy ID người chơi hợp lệ!**\n\n📝 **Ví dụ đúng:**\n`/update-leaderboard WIN [10,17,7]`\n`/update-leaderboard LOSE [20,19]`\n`/update-leaderboard DRAW [8,9]`\n\n📝 **Lưu ý:** ID phải là số nguyên hợp lệ',
  invalidPlayerIds:
    '❌ **ID người chơi không hợp lệ:** {invalidIds}\n\n📝 **Lưu ý:** ID phải là số nguyên dương',
  goalUpdateSuccess:
    '⚽ **CẬP NHẬT BÀN THẮNG** ⚽\n\n👤 **Người chơi:** {playerNumber}\n📊 **Thay đổi:** {valueText} goal\n\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng mới',
  assistUpdateSuccess:
    '🎯 **CẬP NHẬT KIẾN TẠO** 🎯\n\n👤 **Người chơi:** {playerNumber}\n📊 **Thay đổi:** {valueText} assist\n\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng mới',
  goalUpdateError: '❌ Có lỗi xảy ra khi cập nhật goal. Vui lòng thử lại sau.',
  assistUpdateError:
    '❌ Có lỗi xảy ra khi cập nhật assist. Vui lòng thử lại sau.',
  updateError: '❌ Có lỗi xảy ra khi cập nhật thống kê. Vui lòng thử lại sau.',
  updateUsage:
    '📝 **Cách sử dụng lệnh update-leaderboard:**\n\n📝 **Cú pháp:**\n`/update-leaderboard WIN [id1,id2,id3]` - Cập nhật thắng\n`/update-leaderboard LOSE [id1,id2,id3]` - Cập nhật thua\n`/update-leaderboard DRAW [id1,id2,id3]` - Cập nhật hòa\n`/update-leaderboard GOAL player_number value` - Cập nhật bàn thắng\n`/update-leaderboard ASSIST player_number value` - Cập nhật kiến tạo\n\n**Ví dụ:**\n`/update-leaderboard WIN [10,17,7]`\n`/update-leaderboard LOSE [20,19]`\n`/update-leaderboard DRAW [8,9]`\n`/update-leaderboard GOAL 10 1`\n`/update-leaderboard ASSIST 10 +1`\n\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng',
  helpMessage:
    '📝 **Cách sử dụng lệnh update-leaderboard:**\n\n📝 **Cú pháp:**\n`/update-leaderboard WIN [id1,id2,id3]` - Cập nhật thắng\n`/update-leaderboard LOSE [id1,id2,id3]` - Cập nhật thua\n`/update-leaderboard DRAW [id1,id2,id3]` - Cập nhật hòa\n`/update-leaderboard GOAL player_number value` - Cập nhật bàn thắng\n`/update-leaderboard ASSIST player_number value` - Cập nhật kiến tạo\n\n**Ví dụ:**\n`/update-leaderboard WIN [10,17,7]`\n`/update-leaderboard LOSE [20,19]`\n`/update-leaderboard DRAW [8,9]`\n`/update-leaderboard GOAL 10 1`\n`/update-leaderboard ASSIST 10 +1`\n\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng',
};

module.exports = {
  VALIDATION,
  ADD,
  ADD_ME,
  ADD_TO_TEAM,
  BENCH,
  REMOVE,
  CLEAR_BENCH,
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
  UNKNOWN,
  CHIA_TIEN,
  TIEN_SAN,
  SAN,
  TAO_VOTE,
  REGISTER,
  UPDATE_LEADERBOARD,
};
