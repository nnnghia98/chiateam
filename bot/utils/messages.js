const { formatMoney } = require('./format');

const VALIDATION = {
  onlyAdmin: '⛔ Chỉ admin mới có quyền.',
};

const ADD = {
  instruction: `📋 *Cách sử dụng /add:*
• \`/add name 1, name 2, name 3, ...\` - Thêm nhiều member vào bench cùng lúc

Ví dụ: \`/add Nghia, Nghia 1, Nghia 2\``,
  warning:
    '⚠️ Nhập tên member để thêm vào bench. Ví dụ:\n\`/add Nghia, Nghia 1, Nghia 2\`',
  invalidNames: '⚠️ Các tên không hợp lệ (bị bỏ qua): ',
  success: '✅ Đã thêm ${addedCount} member(s) vào /bench',
  noNewMembers:
    '⚠️ Không có member mới được thêm. Tất cả member đã có trong /bench',
  invalidNamesMessage(invalidNames) {
    return `${ADD.invalidNames} ${invalidNames.join(', ')}`;
  },
};

const ADD_ME = {
  warning: '⚠️ Tên không hợp lệ.',
  duplicate: '⚠️ Đã có tên ${name} trong bench.',
  success: '✅ ${name} lên bench!',
};

const ADD_TO_TEAM = {
  emptyBench: '⚠️ Bench trống. Thêm member trước.',
  instruction:
    '📋 *Bench hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/addtoteam [2|3] {team} 1,3,5` - Chọn member số 1, 3, 5\n• `/addtoteam [2|3] {team} 1-3` - Chọn member từ 1 đến 3\n• `/addtoteam [2|3] {team} all` - Chọn tất cả\n\n_Mode: 2 (2 teams) | 3 (3 teams) - mặc định: 2_\n_Team: HOME | AWAY | EXTRA_',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/addtoteam HOME 1,3,5` hoặc `/addtoteam 3 HOME 1-3` hoặc `/addtoteam HOME all`',
  success:
    '✅ Đã thêm {count} member(s) vào {team}:\n{selectedNames}\n\n👤 *{team} hiện tại:*\n{teamMembers}',
  duplicateSkipped:
    '⚠️ Đã bỏ qua {count} member đã có trong {team}:\n{names}\n\n',
  allDuplicates: '⚠️ Tất cả {count} member đã có trong {team} rồi.',
};

const BENCH = {
  emptyBench: '⚠️ Bench trống.',
  success: '👥 Danh sách hiện tại:\n{names}',
  refreshError: '❌ Không thể tải bench hiện tại từ API.',
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
  listError: '❌ Có lỗi xảy ra. Vui lòng thử lại.',
  removeError: '❌ Có lỗi xảy ra khi xóa người chơi. Vui lòng thử lại.',
};

const EDIT_BENCH = {
  emptyBench: '⚠️ Bench trống.',
  instruction:
    '📋 *Bench hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/editbench [số] [tên mới]` - Đổi tên member theo thứ tự trong bench\n\nVí dụ: `/editbench 2 Minh`',
  invalidSelection:
    '⚠️ Số thứ tự không hợp lệ. Dùng `/editbench` để xem danh sách và chọn lại.',
  invalidName: '⚠️ Tên mới không hợp lệ.',
  duplicateName: '⚠️ Tên `{name}` đã tồn tại trong bench.',
  success: '✅ Đã đổi tên: `{oldName}` → `{newName}`',
};

const CLEAR_TEAM = {
  emptyTeam: '⚠️ Chưa chia team.',
  success: '✅ Đã xóa toàn bộ team.',
  stack2Empty: '⚠️ 2-team stack đã trống rồi.',
  stack2Success: '✅ Đã xóa toàn bộ 2-team stack (HOME, AWAY).',
  stack3Empty: '⚠️ 3-team stack đã trống rồi.',
  stack3Success: '✅ Đã xóa toàn bộ 3-team stack (HOME, AWAY, EXTRA).',
};

const RESET = {
  success:
    '🔄 *ĐÃ RESET TOÀN BỘ DỮ LIỆU*\n\n✅ Đã xóa:\n• Bench\n• Tất cả các team\n• Tiền sân → null\n• Team thua → null',
};

const CLEAR_TEAM_INDIVIDUAL = {
  emptyTeam: '⚠️ {team} trống.',
  instruction:
    '👤 *{team} hiện tại:*\n\n{numberedList}\n\n💡 *Cách sử dụng:*\n• `/clearteam` - Xóa tất cả team\n• `/clearteam 2` - Xóa 2-team stack (HOME, AWAY)\n• `/clearteam 3` - Xóa 3-team stack (HOME, AWAY, EXTRA)\n• `/clearteam [2|3]{teamType} 1,3,5` - Xóa member số 1, 3, 5 khỏi team\n• `/clearteam [2|3]{teamType} 1-3` - Xóa member từ 1 đến 3 khỏi team\n• `/clearteam [2|3]{teamType} all` - Xóa tất cả member khỏi team\n• `/clearteam [2|3]{teamType} "John"` - Xóa member theo tên\n\n_Mode: 2 (2 teams) | 3 (3 teams) - mặc định: 2_',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/clearteam HOME 1,3,5` hoặc `/clearteam 3 HOME 1-3` hoặc `/clearteam HOME all`',
  noResetMembers: '⚠️ Không có member nào được xóa.',
  success: '✅ Đã xóa {count} member(s) khỏi {team}:\n{resetNames}',
};

const UNKNOWN = {
  warning:
    '❓ Lệnh này hiện chưa được hỗ trợ.\n\nSử dụng `/start` để xem các lệnh khả dụng.',
  buildWarning(userName) {
    return `${userName}: ${UNKNOWN.warning}`;
  },
};

const CHIA_TIEN = {
  instruction: '💸 Bạn chưa thêm tiền sân. Dùng /tiensan [số tiền] trước.',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  totalMembers:
    '💸 Tổng tiền: {tiensan} VND\n👥 Số người: {totalMembers}\n\nMỗi người phải trả: {perMember} VND',
};

const TIEN_SAN = {
  instruction: '⚠️ Vui lòng nhập số tiền hợp lệ. Ví dụ: /tiensan 1000000',
  empty: '⚠️ Chưa thêm tiền sân.',
  current: '💰 Tiền sân hiện tại: {value} VND',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  success: '✅ Đã cập nhật tiền sân: {value} VND',
};

const SAN = {
  noSan: '⚠️ Chưa lưu sân nào. Dùng /san [tên sân] để lưu.',
  currentSan: 'Sân: {value}',
  currentAnnouncement: 'Sân: {value}',
  successSan: '✅ Đã lưu sân: {value}',
  successDeleteSan: '✅ Đã xóa sân.',
};

const TAO_VOTE = {
  instruction:
    '📊 *Cách sử dụng /taovote:*\n' +
    '• `/taovote [question]` - Tạo vote với câu hỏi và 4 lựa chọn cố định (0, +1, +2, +3, +4)\n' +
    '• `/demvote` - Kiểm tra kết quả vote\n' +
    '• `/sync` - Đồng bộ người vote vào bench (admin)\n' +
    '• `/clearvote` - Xóa tất cả vote đang hoạt động (admin)\n' +
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
  clearSuccess: '🗑️ Đã xoá vote.',
  noVoterLine: '*Ai vote?* Chưa có ai vote',
  totalVotersLine: '*Số người vote:* {count}',
  buildVoteResult({ question, options, votes, totalVoters }) {
    let resultText = `${TAO_VOTE.result.replace('${question}', question)}\n\n`;

    options.forEach((option, idx) => {
      const voters = Object.values(votes)
        .filter(vote => vote.options.includes(idx))
        .map(vote => vote.name);

      resultText += `*${option}* (${voters.length})\n`;
      if (voters.length > 0) {
        resultText += `*Ai vote?* ${voters.join(', ')}\n`;
      } else {
        resultText += `${TAO_VOTE.noVoterLine}\n`;
      }
      resultText += '\n';
    });

    resultText += TAO_VOTE.totalVotersLine.replace(
      '{count}',
      totalVoters || 0
    );

    return resultText;
  },
  buildSyncSummary({
    question,
    totalVoters,
    addedCount,
    addedNames,
    skippedCount,
    skippedNames,
  }) {
    let message = '🔄 *ĐÃ ĐỒNG BỘ TỪ VOTE*\n\n';
    message += `📊 Vote: "${question}"\n`;
    message += `👥 Tổng số người vote: ${totalVoters}\n\n`;

    if (addedCount > 0) {
      message += `✅ *Đã thêm vào bench (${addedCount}):*\n`;
      message += addedNames.map((name, index) => `${index + 1}. ${name}`).join('\n');
      message += '\n\n';
    }

    if (skippedCount > 0) {
      message += `⏭️ *Đã có trong bench (${skippedCount}):*\n`;
      message += skippedNames
        .map((name, index) => `${index + 1}. ${name}`)
        .join('\n');
    }

    return message;
  },
};

const REGISTER = {
  needPrivateChat:
    '⚠️ Lệnh này cần được gửi từ tài khoản cá nhân (có thông tin người gửi).',
  instruction: `📋 *Cách sử dụng /register:*
• \`/register [NUMBER]\` - Đăng ký với số áo (tên & userId lấy từ Telegram)
• \`/register NAME NUMBER\` - (Chỉ admin) Đăng ký slot cho người khác
• \`/register NUMBER DELETE\` - (Chỉ admin) Xóa cầu thủ theo số áo

Ví dụ: \`/register 10\` hoặc \`/register Nghia 10\` (admin)`,
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

🎯 Bây giờ bạn có thể sử dụng:
• \`/players\` - Xem danh sách cầu thủ & thống kê
• \`/player\` - Xem thông số chi tiết`,
  registeredForAnotherSuccess:
    '✅ Đã đăng ký slot cầu thủ: **${name}** – số áo **${number}**. Cầu thủ có thể dùng `/register ${number}` để nhận slot.',
  deleteSuccess: '✅ Đã xóa cầu thủ số áo **${number}**.',
  deleteNotFound: '⚠️ Không tìm thấy cầu thủ với số áo **${number}**.',
  error: '❌ Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.',
};

const START = {
  help: `👋 *CHIATEAM BOT*

*BẮT ĐẦU NHANH*
• \`/addme\` - Tự thêm mình vào bench
• \`/bench\` - Xem danh sách đang chờ
• \`/chiateam\` - Chia 2 team
• \`/team\` - Xem kết quả chia team

*DANH SÁCH LỆNH*

*BENCH*
• \`/addme\` - Tự vào bench
• \`/add\` - Thêm người vào bench
• \`/bench\` - Xem bench hiện tại
• \`/editbench\` - Đổi tên người trong bench (admin)
• \`/clearbench\` - Xóa người khỏi bench

*TEAM*
• \`/chiateam\` - Chia 2 team HOME / AWAY
• \`/chiateam 3\` - Chia 3 team HOME / AWAY / EXTRA (admin)
• \`/team\` - Xem 2 team hiện tại
• \`/team 3\` - Xem 3 team hiện tại
• \`/addtoteam\` - Thêm người vào team
• \`/clearteam\` - Xóa người khỏi team

*TRẬN ĐẤU*
• \`/match\` - Xem trận tuần này
• \`/match SAVE\` - Lưu trận từ dữ liệu hiện tại
• \`/match dd/mm/yyyy\` - Xem trận theo ngày
• \`/match dd/mm/yyyy DELETE\` - Xóa trận theo ngày (admin)
• \`/matches\` - Xem các trận gần đây
• \`/san\` - Xem hoặc lưu sân
• \`/clearsan\` - Xóa sân hiện tại (admin)
• \`/tiensan\` - Xem hoặc cập nhật tiền sân
• \`/chiatien\` - Chia tiền sân
• \`/taovote\` - Tạo vote
• \`/demvote\` - Xem kết quả vote
• \`/sync\` - Đồng bộ người vote vào bench (admin)
• \`/clearvote\` - Xóa vote hiện tại (admin)

*CẦU THỦ*
• \`/register\` - Đăng ký cầu thủ
• \`/me\` - Xem thông tin của bạn
• \`/players\` - Xem danh sách cầu thủ
• \`/player\` - Xem thông số chi tiết

*ADMIN*
• \`/edit-stats\` - Chỉnh thống kê cầu thủ
• \`/reset\` - Reset toàn bộ dữ liệu bot

💡 Dùng \`/start\` bất cứ lúc nào để xem lại hướng dẫn.`,
};

const MATCH = {
  usage:
    '📋 *Cách sử dụng /match:*\n' +
    '• `/match` - Xem trận đấu tuần này (thứ Năm)\n' +
    '• `/match SAVE` - Lưu trận đấu tuần này từ dữ liệu hiện tại (/san, /tiensan, /chiateam)\n' +
    '• `/match dd/mm/yyyy` - Xem trận đấu theo ngày\n' +
    '• `/match dd/mm/yyyy SAVE` - Lưu trận đấu theo ngày\n' +
    '• `/match 3-1` hoặc `/match dd/mm/yyyy 3-1` - Cập nhật tỷ số (HOME-AWAY)\n' +
    '• `/match goal 10 2` - Cầu thủ số 10 ghi 2 bàn\n' +
    '• `/match assist 10 1` - Cầu thủ số 10 1 kiến tạo\n' +
    '• `/match mvp 10` - Cầu thủ số 10 là MVP\n' +
    '• `/match dd/mm/yyyy DELETE` - Xóa trận đấu (chỉ admin)\n\n' +
    'Ví dụ: `/match 23/02/2026` hoặc `/match 23/02/2026 3-1`',
  invalidDate:
    '⚠️ Ngày không hợp lệ. Dùng định dạng dd/mm/yyyy. Ví dụ: 23/02/2026',
  invalidScore: '⚠️ Tỷ số không hợp lệ. Dùng định dạng HOME-AWAY, ví dụ: 3-1',
  noMatch:
    '📭 Chưa có trận đấu nào được lưu cho ngày này. Dùng `/match SAVE` hoặc `/match dd/mm/yyyy SAVE` để lưu.',
  noDataToSave:
    '⚠️ Không đủ dữ liệu để lưu. Cần có team (/chiateam) và ít nhất sân hoặc tiền sân (/san, /tiensan).',
  saved: '✅ Đã lưu trận đấu!',
  scoreUpdated: '✅ Đã cập nhật tỷ số!',
  goalUpdated: '✅ Đã cập nhật bàn thắng!',
  assistUpdated: '✅ Đã cập nhật kiến tạo!',
  mvpUpdated: '✅ Đã cập nhật MVP!',
  playerNotInMatch: '⚠️ Cầu thủ số {number} không có trong trận đấu này.',
  invalidPlayerNumber: '⚠️ Số áo không hợp lệ.',
  deleteSuccess: '✅ Đã xóa trận đấu.',
  deleteNoMatch: '📭 Không có trận đấu nào cho ngày này để xóa.',
  deleteNeedDate:
    '⚠️ Cần chỉ rõ ngày để xóa. Ví dụ: /match 23/02/2026 DELETE (chỉ admin).',
  deleteError: '❌ Có lỗi xảy ra khi xóa trận đấu. Vui lòng thử lại.',
  genericError: '❌ Có lỗi xảy ra. Vui lòng thử lại.',
  saveError: '❌ Có lỗi xảy ra khi lưu trận đấu. Vui lòng thử lại.',
  fetchError: '❌ Có lỗi xảy ra khi tải trận đấu. Vui lòng thử lại.',
  buildMatchMessage(match, dateLabel, aiSummary = null) {
    let message = `⚽ *Trận đấu ${dateLabel}* ⚽\n\n`;

    if (match.san) {
      message += `📍 Sân: ${match.san}\n`;
    }

    if (match.tiensan) {
      message += `💸 Tiền sân: ${formatMoney(match.tiensan)} VND\n`;
    }

    if (match.home_score != null && match.away_score != null) {
      message += `\n📊 Kết quả: ${match.home_score} - ${match.away_score}\n`;
    }

    const formatPlayerLine = player => {
      let line = `• ${player.label}`;
      if (player.goals != null || player.assists != null || player.isMvp) {
        const parts = [];
        if (player.goals) parts.push(`${player.goals}⚽`);
        if (player.assists) parts.push(`${player.assists}🎯`);
        if (player.isMvp) parts.unshift('⭐');
        if (parts.length) {
          line += ` (${parts.join(' ')})`;
        }
      }
      return line;
    };

    message += '\n⚪ *HOME:*\n';
    message += (match.homePlayers || []).map(formatPlayerLine).join('\n') || '• (trống)';
    message += '\n\n⚫ *AWAY:*\n';
    message += (match.awayPlayers || []).map(formatPlayerLine).join('\n') || '• (trống)';

    if (match.extraPlayers && match.extraPlayers.length > 0) {
      message += '\n\n🟠 *EXTRA:*\n';
      message += match.extraPlayers.map(formatPlayerLine).join('\n');
    }

    if (aiSummary) {
      message += `\n\n🤖 *Bình luận AI:*\n${aiSummary}`;
    }

    return message;
  },
  buildScoreUpdatedMessage(match, dateLabel, aiSummary = null) {
    return `${MATCH.scoreUpdated}\n\n${MATCH.buildMatchMessage(
      match,
      dateLabel,
      aiSummary
    )}`;
  },
  buildSavedMessage(match, dateLabel) {
    return `${MATCH.saved}\n\n${MATCH.buildMatchMessage(match, dateLabel)}`;
  },
};

const MATCHES = {
  empty: '📭 Chưa có trận đấu nào được lưu.',
  error: '❌ Có lỗi xảy ra khi tải danh sách trận đấu. Vui lòng thử lại.',
  buildList(matchLines) {
    return `📅 *Danh sách trận đấu* 📅\n\n${matchLines.join(
      '\n'
    )}\n\n💡 Dùng \`/match dd/mm/yyyy\` để xem chi tiết`;
  },
};

const PLAYERS = {
  header: '👥 **DANH SÁCH CẦU THỦ** 👥',
  empty: '📭 Chưa có cầu thủ nào đăng ký. Dùng `/register [số áo]` để đăng ký.',
  error: '❌ Có lỗi khi tải danh sách cầu thủ. Vui lòng thử lại sau.',
  buildList(players, statsByNumber) {
    let message = `${PLAYERS.header}\n\n`;

    players.forEach((player, index) => {
      const stats = statsByNumber[player.number] || {};
      const totalMatch = stats.total_match ?? 0;
      const totalWin = stats.total_win ?? 0;
      const totalLose = stats.total_lose ?? 0;
      const totalDraw = stats.total_draw ?? 0;
      const goal = stats.goal ?? 0;
      const assist = stats.assist ?? 0;
      const winrate =
        stats.winrate != null ? (stats.winrate * 100).toFixed(1) : '0.0';

      message += `**${index + 1}. ${player.name}** (#${player.number})\n`;
      message += `   📊 Trận: ${totalMatch} | Thắng: ${totalWin} | Thua: ${totalLose} | Hòa: ${totalDraw}\n`;
      message += `   ⚽ ${goal} bàn | 🎯 ${assist} KT | Winrate: ${winrate}%\n\n`;
    });

    return message;
  },
};

const PLAYER = {
  usage:
    '📝 **Cách sử dụng lệnh player:**\n\n' +
    '📝 **Cú pháp:**\n' +
    '`/player [player_no]`\n\n' +
    '**Ví dụ:**\n' +
    '`/player 1001`\n' +
    '`/player 12345`\n\n' +
    '💡 **Lưu ý:**\n' +
    '• Số áo phải là số nguyên dương\n' +
    '• Player phải có dữ liệu thống kê để xem được\n' +
    '• Dùng `/players` để xem bảng thống kê tổng hợp\n' +
    '• Dùng `/match dd/mm/yyyy` để xem chi tiết một trận',
  invalidNumber:
    '❌ **Số áo không hợp lệ!**\n\n' +
    '📝 **Cách sử dụng:**\n' +
    '`/player [player_no]`\n\n' +
    '**Ví dụ:**\n' +
    '`/player 1001`\n' +
    '`/player 12345`',
  noStats:
    '❌ **Không tìm thấy thông số của player số áo: ${playerId}**\n\n' +
    '📭 Player này chưa có dữ liệu thống kê nào.\n' +
    'Dùng `/players` để xem danh sách player hiện có.',
  fetchError: '❌ Có lỗi xảy ra khi tải thông số player. Vui lòng thử lại sau.',
  performanceExcellent: '🔥 **Xuất sắc** - Player rất mạnh!',
  performanceGood: '⭐ **Tốt** - Player có kỹ năng tốt',
  performanceAverage: '📉 **Trung bình** - Cần cải thiện thêm',
  performanceNeedsWork: '📉 **Cần cải thiện** - Nên luyện tập thêm',
  buildStatsMessage({ playerId, playerStats }) {
    const winratePercent = (playerStats.winrate * 100).toFixed(1);
    const totalGames = playerStats.total_match;
    const totalWins = playerStats.total_win;
    const totalLosses = playerStats.total_lose;
    const totalDraws = playerStats.total_draw || 0;
    const totalGoals = playerStats.goal || 0;
    const totalAssists = playerStats.assist || 0;
    const winLossRatio =
      totalLosses > 0
        ? (totalWins / totalLosses).toFixed(2)
        : totalWins > 0
          ? '∞'
          : '0.00';
    const rankEmoji = totalWins > 0 ? '🏆' : totalGames > 0 ? '📊' : '👤';

    let message = `${rankEmoji} **THÔNG SỐ PLAYER** ${rankEmoji}\n\n`;
    message += `🆔 **Player số áo:** ${playerId}\n`;
    message += `📅 **Ngày tạo:** ${new Date(playerStats.created_at).toLocaleDateString(
      'vi-VN'
    )}\n`;
    message += `🔄 **Cập nhật lần cuối:** ${new Date(
      playerStats.updated_at
    ).toLocaleDateString('vi-VN')}\n\n`;
    message += '📊 **THỐNG KÊ CHI TIẾT:**\n';
    message += `   • 🎮 **Tổng trận:** ${totalGames}\n`;
    message += `   • ✅ **Thắng:** ${totalWins}\n`;
    message += `   • ❌ **Thua:** ${totalLosses}\n`;
    message += `   • 🤝 **Hòa:** ${totalDraws}\n`;
    message += `   • ⚽ **Bàn thắng:** ${totalGoals}\n`;
    message += `   • 🎯 **Kiến tạo:** ${totalAssists}\n`;
    message += `   • 🎯 **Tỷ lệ thắng:** ${winratePercent}%\n`;
    message += `   • ⚖️ **Tỷ lệ W/L:** ${winLossRatio}\n\n`;

    if (totalGames > 0) {
      const winPercentage = ((totalWins / totalGames) * 100).toFixed(1);
      let performance = PLAYER.performanceNeedsWork;

      if (winPercentage >= 80) {
        performance = PLAYER.performanceExcellent;
      } else if (winPercentage >= 60) {
        performance = PLAYER.performanceGood;
      } else if (winPercentage >= 40) {
        performance = PLAYER.performanceAverage;
      }

      message += `📈 **ĐÁNH GIÁ:**\n${performance}\n\n`;
    }

    message += '💡 **Lệnh liên quan:**\n';
    message += '• `/players` - Xem bảng thống kê tổng hợp\n';
    message += '• `/match dd/mm/yyyy` - Xem chi tiết và cập nhật một trận';

    return message;
  },
};

const EDIT_STATS = {
  invalidSyntax:
    '❌ **Cú pháp không đúng!**\n\n' +
    '📝 **Cách sử dụng:**\n' +
    '`/edit-stats player_id total_match total_win total_lose total_draw`\n\n' +
    '**Ví dụ:**\n' +
    '`/edit-stats 1001 10 7 2 1`\n' +
    '`/edit-stats 1002 5 2 2 1`',
  invalidPlayerId:
    '❌ **ID người chơi không hợp lệ!**\n\n' +
    '📝 **Lưu ý:** ID phải là số nguyên dương',
  invalidTotalMatch:
    '❌ **Số trận đấu không hợp lệ!**\n\n' +
    '📝 **Lưu ý:** Số trận phải là số nguyên không âm',
  invalidTotalWin:
    '❌ **Số trận thắng không hợp lệ!**\n\n' +
    '📝 **Lưu ý:** Số trận thắng phải là số nguyên không âm',
  invalidTotalLose:
    '❌ **Số trận thua không hợp lệ!**\n\n' +
    '📝 **Lưu ý:** Số trận thua phải là số nguyên không âm',
  invalidTotalDraw:
    '❌ **Số trận hòa không hợp lệ!**\n\n' +
    '📝 **Lưu ý:** Số trận hòa phải là số nguyên không âm',
  error: '❌ Có lỗi xảy ra khi chỉnh sửa thống kê. Vui lòng thử lại sau.',
  usage:
    '📝 **Cách sử dụng lệnh edit-stats:**\n\n' +
    '📝 **Cú pháp:**\n' +
    '`/edit-stats player_id total_match total_win total_lose total_draw`\n\n' +
    '**Ví dụ:**\n' +
    '`/edit-stats 1001 10 7 2 1` - 10 trận, 7 thắng, 2 thua, 1 hòa\n' +
    '`/edit-stats 1002 5 2 2 1` - 5 trận, 2 thắng, 2 thua, 1 hòa\n\n' +
    '📝 **Lưu ý:**\n' +
    '• Tổng số trận = Số trận thắng + Số trận thua + Số trận hòa\n' +
    '• Tất cả số liệu phải là số nguyên không âm\n' +
    '• Winrate sẽ được tính tự động',
  buildInvalidTotalsMessage({ totalMatch, totalWin, totalLose, totalDraw }) {
    return (
      '❌ **Dữ liệu không hợp lệ!**\n\n' +
      '📝 **Lưu ý:** Tổng số trận = Số trận thắng + Số trận thua + Số trận hòa\n\n' +
      '📊 **Dữ liệu hiện tại:**\n' +
      `   • Tổng trận: ${totalMatch}\n` +
      `   • Thắng: ${totalWin}\n` +
      `   • Thua: ${totalLose}\n` +
      `   • Hòa: ${totalDraw}\n` +
      `   • Tổng: ${totalWin + totalLose + totalDraw}`
    );
  },
  buildSuccessMessage({
    playerId,
    currentStats,
    totalMatch,
    totalWin,
    totalLose,
    totalDraw,
  }) {
    const winrate =
      totalMatch > 0 ? Math.round((totalWin / totalMatch) * 1000) / 1000 : 0;
    const winratePercent = (winrate * 100).toFixed(1);

    let message = '✏️ **CHỈNH SỬA THỐNG KÊ** ✏️\n\n';
    message += `🆔 **ID người chơi:** ${playerId}\n\n`;

    if (currentStats) {
      message += '📊 **Thống kê cũ:**\n';
      message += `   • Trận: ${currentStats.total_match} | Thắng: ${currentStats.total_win} | Thua: ${currentStats.total_lose} | Hòa: ${currentStats.total_draw || 0}\n`;
      message += `   • Winrate: ${(currentStats.winrate * 100).toFixed(1)}%\n\n`;
    }

    message += '📊 **Thống kê mới:**\n';
    message += `   • Trận: ${totalMatch} | Thắng: ${totalWin} | Thua: ${totalLose} | Hòa: ${totalDraw}\n`;
    message += `   • Winrate: ${winratePercent}%\n\n`;

    if (currentStats) {
      const matchDiff = totalMatch - currentStats.total_match;
      const winDiff = totalWin - currentStats.total_win;
      const loseDiff = totalLose - currentStats.total_lose;
      const drawDiff = totalDraw - (currentStats.total_draw || 0);

      message += '📈 **Thay đổi:**\n';
      message += `   • Trận: ${matchDiff > 0 ? '+' : ''}${matchDiff}\n`;
      message += `   • Thắng: ${winDiff > 0 ? '+' : ''}${winDiff}\n`;
      message += `   • Thua: ${loseDiff > 0 ? '+' : ''}${loseDiff}\n`;
      message += `   • Hòa: ${drawDiff > 0 ? '+' : ''}${drawDiff}\n\n`;
    }

    message += '💡 Sử dụng `/players` để xem danh sách cầu thủ & thống kê mới';
    return message;
  },
};

const ME = {
  notRegistered:
    '\n\n⚠️ Bạn chưa đăng ký làm cầu thủ. Sử dụng "/register" để đăng ký.',
  fetchError: '\n\n❌ Có lỗi xảy ra khi lấy thông tin cầu thủ.',
  buildMessageWithFetchError(context) {
    return `${ME.buildMessage(context)}${ME.fetchError}`;
  },
  buildMessage({ name, userId, username, player }) {
    let message = `👤 **Thông tin của bạn:**\n\n**Tên:** ${name}\n**ID:** ${userId}\n**Username:** @${username}`;

    if (player) {
      message += `\n\n⚽ **Thông tin cầu thủ:**\n**Số áo:** ${player.number}\n**Bàn thắng:** ${player.goal || 0}\n**Kiến tạo:** ${player.assist || 0}`;
    }

    return message;
  },
};

const TEAM = {
  noTeam: '⚠️ Chưa có team nào được chia. Dùng /chiateam trước',
  noTeam3: '⚠️ Chưa có 3 team nào được chia. Dùng /chiateam 3 để chia 3 team',
  buildTwoTeamMessage(homeMembers, awayMembers) {
    return (
      '🎲 *Team hiện tại* 🎲\n\n' +
      `⚪ *HOME:*\n${homeMembers.join('\n')}\n\n` +
      `⚫ *AWAY:*\n${awayMembers.join('\n')}`
    );
  },
  buildThreeTeamMessage(homeMembers, awayMembers, extraMembers) {
    return (
      '🎲 *3 Team hiện tại* 🎲\n\n' +
      `⚪ *HOME:*\n${homeMembers.join('\n') || '(trống)'}\n\n` +
      `⚫ *AWAY:*\n${awayMembers.join('\n') || '(trống)'}\n\n` +
      `🟠 *EXTRA:*\n${extraMembers.join('\n') || '(trống)'}`
    );
  },
};

const CHIA_TEAM = {
  allAssigned: '⚠️ Tất cả member đã có team rồi. Dùng /clearteam để reset.',
  notEnough: '❗ Không đủ người để chia',
  allAssignedThree:
    '⚠️ Tất cả member đã có team rồi. Dùng /clearteam để reset.',
  notEnoughThree: '❗ Cần ít nhất 3 người để chia 3 team',
  buildTwoTeamMessage(homeMembers, awayMembers) {
    return (
      '🎲 *Chia team* 🎲\n\n' +
      `⚪ *HOME:*\n${homeMembers.join('\n')}\n\n` +
      `⚫ *AWAY:*\n${awayMembers.join('\n')}`
    );
  },
  buildThreeTeamMessage(homeMembers, awayMembers, extraMembers) {
    return (
      '🎲 *Chia 3 team* 🎲\n\n' +
      `⚪ *HOME:*\n${homeMembers.join('\n')}\n\n` +
      `⚫ *AWAY:*\n${awayMembers.join('\n')}\n\n` +
      `🟠 *EXTRA:*\n${extraMembers.join('\n')}`
    );
  },
};

const LEADERBOARD = {
  empty: '📊 Bảng xếp hạng trống. Chưa có dữ liệu thống kê nào.',
  error: '❌ Có lỗi xảy ra khi tải bảng xếp hạng. Vui lòng thử lại sau.',
  buildMessage(leaderboard) {
    let message = '🏆 **BẢNG XẾP HẠNG** 🏆\n\n';
    message += '📈 Sắp xếp theo tỷ lệ thắng (Winrate)\n\n';

    leaderboard.forEach((player, index) => {
      const rank = index + 1;
      const medal =
        rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const winratePercent = (player.winrate * 100).toFixed(1);

      message += `${medal} **ID: ${player.player_number}**\n`;
      message += `   📊 Trận: ${player.total_match} | Thắng: ${player.total_win} | Thua: ${player.total_lose} | Hòa: ${player.total_draw || 0}\n`;
      message += `   ⚽ Bàn thắng: ${player.goal || 0} | 🎯 Kiến tạo: ${player.assist || 0}\n`;
      message += `   🎯 Winrate: ${winratePercent}%\n\n`;
    });

    message +=
      '💡 Sử dụng `/update-leaderboard WIN/LOSE/DRAW [id1,id2,id3]` để cập nhật thống kê\n';
    message +=
      '💡 Sử dụng `/update-leaderboard GOAL player_number value` để cập nhật bàn thắng\n';
    message +=
      '💡 Sử dụng `/update-leaderboard ASSIST player_number value` để cập nhật kiến tạo';

    return message;
  },
};

const UPDATE_LEADERBOARD = {
  invalidSyntax:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  invalidGoalAssistSyntax:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng cho {result}.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  invalidPlayerNumber:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  invalidValue:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  invalidResult:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  noValidPlayerIds:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  invalidPlayerIds:
    '❌ **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  goalUpdateSuccess:
    '⚽ **CẬP NHẬT BÀN THẮNG** ⚽\n\n👤 **Người chơi:** {playerNumber}\n📊 **Thay đổi:** {valueText} goal\n\n💡 Dùng `/players` để xem bảng thống kê mới',
  assistUpdateSuccess:
    '🎯 **CẬP NHẬT KIẾN TẠO** 🎯\n\n👤 **Người chơi:** {playerNumber}\n📊 **Thay đổi:** {valueText} assist\n\n💡 Dùng `/players` để xem bảng thống kê mới',
  goalUpdateError: '❌ Có lỗi xảy ra khi cập nhật goal. Vui lòng thử lại sau.',
  assistUpdateError:
    '❌ Có lỗi xảy ra khi cập nhật assist. Vui lòng thử lại sau.',
  updateError:
    '❌ Chức năng cập nhật thống kê đã tạm ngưng. Vui lòng dùng `/players` để xem thống kê hiện tại.',
  updateUsage:
    '📝 **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  helpMessage:
    '📝 **Chức năng cập nhật thống kê đã tạm ngưng.**\n\n💡 Dùng `/players` để xem danh sách cầu thủ & thống kê hiện tại.',
  buildSuccessMessage(result, playerIds) {
    const resultEmoji = result === 'WIN' ? '✅' : result === 'LOSE' ? '❌' : '🤝';
    const resultText =
      result === 'WIN' ? 'THẮNG' : result === 'LOSE' ? 'THUA' : 'HÒA';

    let message = `${resultEmoji} **CẬP NHẬT THỐNG KÊ** ${resultEmoji}\n\n`;
    message += `🎯 **Kết quả:** ${resultText}\n`;
    message += `👥 **Số người chơi:** ${playerIds.length}\n`;
    message += `🆔 **ID người chơi:** ${playerIds.join(', ')}\n\n`;
    message += '📊 **Thay đổi thống kê:**\n';

    playerIds.forEach(playerId => {
      let statChange = '+1 hòa';
      if (result === 'WIN') {
        statChange = '+1 thắng';
      } else if (result === 'LOSE') {
        statChange = '+1 thua';
      }
      message += `   • ID ${playerId}: +1 trận, ${statChange}\n`;
    });

    message += '\n💡 Sử dụng `/leaderboard` để xem bảng xếp hạng mới';
    return message;
  },
};

const AI = {
  disabled:
    '❌ Tính năng AI chưa được kích hoạt. Vui lòng cấu hình GEMINI_API_KEY.',
  usage:
    '💬 *Cách dùng:* `/ai <câu hỏi của bạn>`\n\n' +
    '*Ví dụ:*\n' +
    '• `/ai Hãy viết một câu slogan cho đội bóng`\n' +
    '• `/ai Gợi ý tên đội bóng hay`\n' +
    '• `/ai Tóm tắt luật bóng đá 5 người`',
  chatUsage:
    '💬 *Cách dùng:* `/aichat <tin nhắn>`\n\n' +
    'Khác với `/ai`, lệnh này duy trì ngữ cảnh cuộc trò chuyện.\n' +
    'Sử dụng `/aichat reset` để bắt đầu cuộc trò chuyện mới.',
  thinking: '🤔 Đang suy nghĩ...',
  reset: '✅ Đã reset cuộc trò chuyện AI. Bắt đầu cuộc trò chuyện mới!',
  error:
    '❌ Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra lại API key hoặc thử lại sau.',
  buildResponse(response) {
    return `🤖 *AI trả lời:*\n\n${response}`;
  },
};

module.exports = {
  VALIDATION,
  ADD,
  ADD_ME,
  ADD_TO_TEAM,
  AI,
  BENCH,
  CHIA_TEAM,
  CHIA_TIEN,
  CLEAR_BENCH,
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
  EDIT_BENCH,
  EDIT_STATS,
  LEADERBOARD,
  MATCH,
  MATCHES,
  ME,
  PLAYER,
  PLAYERS,
  REGISTER,
  REMOVE,
  RESET,
  SAN,
  START,
  TAO_VOTE,
  TEAM,
  TIEN_SAN,
  UNKNOWN,
  UPDATE_LEADERBOARD,
};
