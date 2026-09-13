const { formatMoney } = require('./format');
const {
  buildStartHelpSegments,
} = require('../../core/use-cases/common/start-command');
const { formatTelegramMessage } = require('../../platforms/telegram/formatter');

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
  usage:
    '📋 *Cách sử dụng /addtoteam:*\n' +
    '• `/addtoteam HOME` - Chọn member thêm vào Home\n' +
    '• `/addtoteam AWAY` - Chọn member thêm vào Away\n' +
    '• `/addtoteam 3 EXTRA` - Chọn member thêm vào Extra\n' +
    '• `/addtoteam [2|3] HOME|AWAY|EXTRA all` - Thêm tất cả',
  instruction: '📋 Chọn member để thêm vào {team}:',
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
  success: '👥 Danh sách hiện tại:\n{names}\n\nTổng: {count} player(s)',
  refreshError: '❌ Không thể tải bench hiện tại từ API.',
};

const REMOVE = {};

const CLEAR_BENCH = {
  emptyBench: '⚠️ Bench trống.',
  instruction: '📋 Chọn member cần xóa khỏi bench:',
  invalidSelection:
    '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/clearbench 1,3,5` hoặc `/clearbench 1-3` hoặc `/clearbench all`',
  success: '✅ Đã xóa {count} member(s):\n{removedNames}',
  singleSuccess: '✅ Đã xóa {name} khỏi bench.',
  staleButton:
    '⚠️ Lựa chọn này không còn hợp lệ. Dùng /clearbench để tải lại danh sách.',
  clearAllSuccess: '✅ Đã xóa toàn bộ member khỏi bench.',
  noRemovedMembers: '⚠️ Không có member nào bị xóa.',
  listError: '❌ Có lỗi xảy ra. Vui lòng thử lại.',
  removeError: '❌ Có lỗi xảy ra khi xóa người chơi. Vui lòng thử lại.',
};

const EDIT_BENCH = {
  emptyBench: '⚠️ Bench trống.',
  instruction: '📋 Chọn member cần đổi tên:',
  namePrompt: '✏️ Nhập tên mới cho {name}:',
  invalidSelection:
    '⚠️ Số thứ tự không hợp lệ. Dùng `/editbench` để xem danh sách và chọn lại.',
  invalidName: '⚠️ Tên mới không hợp lệ.',
  duplicateName: '⚠️ Tên `{name}` đã tồn tại trong bench.',
  success: '✅ Đã đổi tên: `{oldName}` → `{newName}`',
};

const CLEAR_TEAM = {
  emptyTeam: '⚠️ Chưa chia team.',
  instruction:
    '📋 *Cách sử dụng /clearteam:*\n' +
    '• `/clearteam 2` - Xóa toàn bộ 2-team stack\n' +
    '• `/clearteam 3` - Xóa toàn bộ 3-team stack\n' +
    '• `/clearteam HOME` - Chọn member để xóa khỏi Home\n' +
    '• `/clearteam AWAY` - Chọn member để xóa khỏi Away\n' +
    '• `/clearteam 3 EXTRA` - Chọn member để xóa khỏi Extra',
  success: '✅ Đã xóa toàn bộ team.',
  stack2Empty: '⚠️ 2-team stack đã trống rồi.',
  stack2Success: '✅ Đã xóa toàn bộ 2-team stack (HOME, AWAY).',
  stack3Empty: '⚠️ 3-team stack đã trống rồi.',
  stack3Success: '✅ Đã xóa toàn bộ 3-team stack (HOME, AWAY, EXTRA).',
};

const MANIFEST = {
  emptyBench: '⚠️ Bench trống. Thêm member trước.',
  noCurrent: 'Chưa có manifest nào.',
  current: 'Manifest hiện tại:\n{manifestList}',
  list: '📋 *Danh sách manifest:*\n\n{manifestList}',
  instruction: '📋 Chọn member đầu tiên cho manifest:\n\n{current}',
  relationPrompt: 'Chọn quan hệ cho `{first}`:',
  secondPlayerPrompt: 'Chọn member thứ hai cho `{first}` {symbol}:',
  invalidSelection:
    '⚠️ Cú pháp manifest không hợp lệ. Ví dụ: `/manifest 1 <3 3`, `/manifest 1 ❤️ 3`, `/manifest 1 </3 3` hoặc `/manifest 1 💔 3`',
  success: '🧞‍♂️ Đã nhận nguyện vọng: `{first} {symbol} {second}`',
  replaceSuccess: '♻️ Đã cập nhật nguyện vọng: `{first} {symbol} {second}`',
  conflict:
    '⚠️ Manifest này mâu thuẫn với danh sách hiện tại. Dùng `/mf` để xem hoặc `/removemanifest [số thứ tự]` để xóa manifest cũ.',
  removeInstruction: '📋 Chọn manifest cần xóa:',
  invalidRemoveSelection:
    '⚠️ Số thứ tự manifest không hợp lệ. Dùng `/mf` để xem danh sách manifest.',
  removeSuccess: '✅ Đã xóa manifest: {manifest}',
  clearSuccess: '✅ Đã xóa tất cả manifest.',
};

const RESET = {
  success:
    '🔄 *ĐÃ RESET TOÀN BỘ DỮ LIỆU*\n\n✅ Đã xóa:\n• Bench\n• Tất cả các team\n• Tiền sân\n• Tiền nước\n• Kết quả thắng/thua',
};

const CLEAR_TEAM_INDIVIDUAL = {
  emptyTeam: '⚠️ {team} trống.',
  instruction: '👤 Chọn member cần xóa khỏi {team}:',
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

const CALLBACK_QUERY = {
  unsupported:
    '⚠️ Nút này hiện không còn được hỗ trợ. Dùng /start để xem lệnh hiện có.',
};

const CHIA_TIEN = {
  instruction: '💸 Bạn chưa thêm tiền sân. Dùng /tiensan [số tiền] trước.',
  noMembers: '⚠️ Không có thành viên nào trong team để chia tiền.',
  threeTeamUnsupported:
    '⚠️ Chưa hỗ trợ chia tiền cho 3 team. Tính năng này sẽ được bổ sung sau.',
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

const TIEN_NUOC = {
  instruction: '⚠️ Vui lòng nhập số tiền hợp lệ. Ví dụ: /tiennuoc 60000',
  empty: '⚠️ Chưa thêm tiền nước.',
  current: '🧊 Tiền nước hiện tại: {value} VND',
  success: '✅ Đã cập nhật tiền nước: {value} VND',
};

const TEAM_THUA = {
  noWinner: '⚠️ Chưa chọn team thắng. Dùng `/winner HOME` hoặc `/winner AWAY`',
  winnerCurrent: '📋 Team thắng hiện tại: *{team}*',
  winnerSuccess: '✅ Đã chọn team thắng: *{team}*',
  threeTeamUnsupported:
    '⚠️ Chưa hỗ trợ tính tiền cho 3 team. Hãy dùng 2 team để dùng lệnh này.',
  noTeamThua: '⚠️ Chưa chọn team thua. Dùng `/loser HOME` hoặc `/loser AWAY`',
  current: '📋 Team thua hiện tại: *{team}*',
  success: '✅ Đã chọn team thua: *{team}*',
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
    '• `/taovote [question]` - Tạo vote với câu hỏi và 5 lựa chọn cố định (0, +1, +2, +3, +4)\n' +
    '• `/demvote` - Kiểm tra kết quả vote\n' +
    '• `/sync` - Đồng bộ người vote vào bench (admin)\n' +
    '• `/clearvote` - Xóa tất cả vote đang hoạt động (admin)\n' +
    '\nVí dụ: `/taovote Sân XX ngày YY giờ ZZ`\n' +
    '\n*Lưu ý:* Vote sẽ có 5 lựa chọn: 0, +1, +2, +3, +4',
  shortInstruction:
    '⚠️ Cần nhập câu hỏi cho vote.\n' +
    'Ví dụ: `/taovote Sân XX ngày YY giờ ZZ`',
  voteExists:
    '⚠️ Hiện tại đã có một vote đang hoạt động. Hãy xoá vote cũ trước khi tạo vote mới bằng lệnh /clearvote.',
  explanation: 'Vote được tạo bởi',
  error: '❌ Có lỗi xảy ra khi tạo vote. Vui lòng thử lại.',
  noVoteToClear: '📭 Không có vote nào đang hoạt động để xóa.',
  noVoteToCount: '📭 Không có vote nào đang hoạt động để đếm.',
  noVoteToSync: '📭 Không có vote nào đang hoạt động để đồng bộ.',
  result: '📊 *Kết quả vote hiện tại:*\n*${question}*\n\n',
  clearSuccess: '🗑️ Đã xoá vote.',
  noVoterLine: '*Ai vote?* Chưa có ai vote',
  totalVotersLine: '*Số người vote:* {count}',
  buildVoteResult({ question, options, votes }) {
    let resultText = `${TAO_VOTE.result.replace('${question}', question)}\n\n`;
    const allVotes = Object.values(votes || {});
    const totalVoters = allVotes.reduce((total, vote) => {
      const selectedOption = vote.options?.[0];
      return Number.isInteger(selectedOption) ? total + selectedOption : total;
    }, 0);

    options.forEach((option, idx) => {
      const voters = allVotes
        .filter(vote => vote.options?.includes(idx))
        .map(vote => vote.name);

      resultText += `*${option}* (${voters.length})\n`;
      if (voters.length > 0) {
        resultText += `*Ai vote?* ${voters.join(', ')}\n`;
      } else {
        resultText += `${TAO_VOTE.noVoterLine}\n`;
      }
      resultText += '\n';
    });

    resultText += TAO_VOTE.totalVotersLine.replace('{count}', totalVoters || 0);

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
      message += addedNames
        .map((name, index) => `${index + 1}. ${name}`)
        .join('\n');
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
• \`/me\` - Xem thông tin đăng ký của bạn`,

  registeredForAnotherSuccess:
    '✅ Đã đăng ký slot cầu thủ: **${name}** – số áo **${number}**. Cầu thủ có thể dùng `/register ${number}` để nhận slot.',
  deleteSuccess: '✅ Đã xóa cầu thủ số áo **${number}**.',
  deleteNotFound: '⚠️ Không tìm thấy cầu thủ với số áo **${number}**.',
  error: '❌ Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.',
};

const startHelp = formatTelegramMessage({
  segments: buildStartHelpSegments(),
  actions: [],
});
const START = Object.freeze({
  help: startHelp.text,
  options: Object.freeze(startHelp.options),
});

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
    message +=
      (match.homePlayers || []).map(formatPlayerLine).join('\n') || '• (trống)';
    message += '\n\n⚫ *AWAY:*\n';
    message +=
      (match.awayPlayers || []).map(formatPlayerLine).join('\n') || '• (trống)';

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
      message += `\n\n⚽ **Thông tin cầu thủ:**\n**Tên đăng ký:** ${player.name}\n**Số áo:** ${player.number}`;
    }

    return message;
  },
};

const TEAM = {
  refreshError: '❌ Không thể tải danh sách đội hiện tại từ API.',
  noTeam: '⚠️ Chưa có team nào được chia. Dùng /chiateam trước',
  noTeam3: '⚠️ Chưa có 3 team nào được chia. Dùng /chiateam 3 để chia 3 team',
  buildTwoTeamMessage(homeMembers, awayMembers) {
    return (
      '🎲 *Team hiện tại* 🎲\n\n' +
      `⚪ *HOME (${homeMembers.length}):*\n${homeMembers.join('\n')}\n\n` +
      `⚫ *AWAY (${awayMembers.length}):*\n${awayMembers.join('\n')}`
    );
  },
  buildThreeTeamMessage(homeMembers, awayMembers, extraMembers) {
    return (
      '🎲 *3 Team hiện tại* 🎲\n\n' +
      `⚪ *HOME (${homeMembers.length}):*\n${homeMembers.join('\n') || '(trống)'}\n\n` +
      `⚫ *AWAY (${awayMembers.length}):*\n${awayMembers.join('\n') || '(trống)'}\n\n` +
      `🟠 *EXT (${extraMembers.length}):*\n${extraMembers.join('\n') || '(trống)'}`
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
      `⚪ *HOME (${homeMembers.length}):*\n${homeMembers.join('\n')}\n\n` +
      `⚫ *AWAY (${awayMembers.length}):*\n${awayMembers.join('\n')}`
    );
  },
  buildThreeTeamMessage(homeMembers, awayMembers, extraMembers) {
    return (
      '🎲 *Chia 3 team* 🎲\n\n' +
      `⚪ *HOME (${homeMembers.length}):*\n${homeMembers.join('\n')}\n\n` +
      `⚫ *AWAY (${awayMembers.length}):*\n${awayMembers.join('\n')}\n\n` +
      `🟠 *EXT (${extraMembers.length}):*\n${extraMembers.join('\n')}`
    );
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
  CALLBACK_QUERY,
  CHIA_TEAM,
  CHIA_TIEN,
  CLEAR_BENCH,
  CLEAR_TEAM,
  CLEAR_TEAM_INDIVIDUAL,
  EDIT_BENCH,
  MANIFEST,
  MATCH,
  MATCHES,
  ME,
  REGISTER,
  REMOVE,
  RESET,
  SAN,
  START,
  TAO_VOTE,
  TEAM,
  TEAM_THUA,
  TIEN_NUOC,
  TIEN_SAN,
  UNKNOWN,
};
