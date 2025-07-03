const addToTeam2Command = (bot, members, teamB) => {
  // Handle the main command to show the list
  bot.onText(/\/addtoteam2$/, msg => {
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Danh sách trống. Thêm member trước.');
      return;
    }

    const numberedList = allNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = `📋 *Danh sách member hiện tại:*\n\n${numberedList}\n\n💡 *Cách sử dụng:*\n• \`/addtoteam2 1,3,5\` - Chọn member số 1, 3, 5\n• \`/addtoteam2 1-3\` - Chọn member từ 1 đến 3\n• \`/addtoteam2 all\` - Chọn tất cả`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Handle selection by numbers
  bot.onText(/\/addtoteam2 (.+)/, (msg, match) => {
    const selection = match[1].trim();
    const allNames = Array.from(members.values());

    if (allNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Danh sách trống. Thêm member trước.');
      return;
    }

    let selectedIndices = [];

    if (selection.toLowerCase() === 'all') {
      // Select all members
      selectedIndices = allNames.map((_, index) => index);
    } else {
      // Parse selection (e.g., "1,3,5" or "1-3")
      const parts = selection.split(',').map(part => part.trim());

      for (const part of parts) {
        if (part.includes('-')) {
          // Range selection (e.g., "1-3")
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
          // Single number selection
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
        '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/addtoteam2 1,3,5` hoặc `/addtoteam2 1-3` hoặc `/addtoteam2 all`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Sort indices to maintain order
    selectedIndices.sort((a, b) => a - b);

    const selectedNames = selectedIndices.map(index => allNames[index]);

    // Remove selected members from main list
    selectedNames.forEach(name => {
      for (const [userId, memberName] of members) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          members.delete(userId);
          break;
        }
      }
    });

    // Add to Team B
    selectedNames.forEach((name, idx) => {
      const fakeId = Date.now() + Math.random() + idx;
      teamB.set(fakeId, name);
    });

    const message = `✅ Đã thêm ${selectedNames.length} member(s) vào Team B:\n${selectedNames.join('\n')}\n\n👤 *Team B hiện tại:*\n${Array.from(teamB.values()).join('\n')}`;

    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = addToTeam2Command;
