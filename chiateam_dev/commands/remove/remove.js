const removeCommand = (bot, members) => {
  // Show numbered list for removal
  bot.onText(/\/remove$/, msg => {
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Danh sách trống.');
      return;
    }

    const numberedList = allNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = `📋 *Danh sách member hiện tại:*\n\n${numberedList}\n\n💡 *Cách sử dụng:*\n• \`/remove 1,3,5\` - Xóa member số 1, 3, 5\n• \`/remove 1-3\` - Xóa member từ 1 đến 3\n• \`/remove all\` - Xóa tất cả`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Remove by number(s), range(s), or all
  bot.onText(/\/remove (.+)/, (msg, match) => {
    const selection = match[1].trim();
    const allNames = Array.from(members.values());
    if (allNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Danh sách trống.');
      return;
    }
    let selectedIndices = [];
    if (selection.toLowerCase() === 'all') {
      selectedIndices = allNames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(num => parseInt(num.trim()));
          if (
            !isNaN(start) &&
            !isNaN(end) &&
            start > 0 &&
            end <= allNames.length &&
            start <= end
          ) {
            for (let i = start - 1; i < end; i++) {
              if (!selectedIndices.includes(i)) {
                selectedIndices.push(i);
              }
            }
          }
        } else {
          const num = parseInt(part);
          if (!isNaN(num) && num > 0 && num <= allNames.length) {
            const index = num - 1;
            if (!selectedIndices.includes(index)) {
              selectedIndices.push(index);
            }
          }
        }
      }
    }
    if (selectedIndices.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/remove 1,3,5` hoặc `/remove 1-3` hoặc `/remove all`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    selectedIndices.sort((a, b) => b - a); // Remove from end to avoid index shift
    const removedNames = [];
    for (const index of selectedIndices) {
      const name = allNames[index];
      // Remove from members
      for (const [userId, memberName] of members) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          members.delete(userId);
          removedNames.push(name);
          break;
        }
      }
    }
    if (removedNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Không có member nào bị xóa.');
      return;
    }
    const message = `✅ Đã xóa ${removedNames.length} member(s):\n${removedNames.join('\n')}`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = removeCommand;
