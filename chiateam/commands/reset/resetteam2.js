const { isAdmin } = require('../../utils/validate');

const resetteam2Command = (bot, teamB, members) => {
  // Show numbered list for reset from teamB
  bot.onText(/\/resetteam2$/, msg => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền reset team.');
      return;
    }

    const teamBNames = Array.from(teamB.values());

    if (teamBNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Team B trống.');
      return;
    }

    const numberedList = teamBNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');

    const message = `👤 *Team B hiện tại:*\n\n${numberedList}\n\n💡 *Cách sử dụng:*\n• \`/resetteam2 1,3,5\` - Reset member số 1, 3, 5 về list\n• \`/resetteam2 1-3\` - Reset member từ 1 đến 3 về list\n• \`/resetteam2 all\` - Reset tất cả member về list\n• \`/resetteam2 "John"\` - Reset member theo tên`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Reset member(s) from teamB back to main list
  bot.onText(/\/resetteam2 (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      bot.sendMessage(msg.chat.id, '⛔ Chỉ admin mới có quyền reset team.');
      return;
    }

    const selection = match[1].trim();
    const teamBNames = Array.from(teamB.values());

    if (teamBNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Team B trống.');
      return;
    }

    let selectedIndices = [];

    if (selection.toLowerCase() === 'all') {
      selectedIndices = teamBNames.map((_, index) => index);
    } else {
      const parts = selection.split(',').map(part => part.trim());

      for (const part of parts) {
        // Check if it's a quoted name
        if (part.startsWith('"') && part.endsWith('"')) {
          const nameToFind = part.slice(1, -1).trim();
          const nameIndex = teamBNames.findIndex(name =>
            name.toLowerCase().includes(nameToFind.toLowerCase())
          );
          if (nameIndex !== -1) {
            selectedIndices.push(nameIndex);
          }
        } else if (part.includes('-')) {
          const [start, end] = part.split('-').map(num => parseInt(num.trim()));
          if (
            !isNaN(start) &&
            !isNaN(end) &&
            start > 0 &&
            end <= teamBNames.length &&
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
          if (!isNaN(num) && num > 0 && num <= teamBNames.length) {
            const index = num - 1;
            if (!selectedIndices.includes(index)) {
              selectedIndices.push(index);
            }
          } else {
            // Try to find by name
            const nameIndex = teamBNames.findIndex(name =>
              name.toLowerCase().includes(part.toLowerCase())
            );
            if (nameIndex !== -1) {
              selectedIndices.push(nameIndex);
            }
          }
        }
      }
    }

    if (selectedIndices.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Không có lựa chọn hợp lệ. Ví dụ:\n`/resetteam2 1,3,5` hoặc `/resetteam2 1-3` hoặc `/resetteam2 all` hoặc `/resetteam2 "John"`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Remove duplicates and sort
    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => b - a);
    const resetNames = [];

    for (const index of selectedIndices) {
      const name = teamBNames[index];

      // Find and remove from teamB
      for (const [userId, memberName] of teamB) {
        const nameOnly = memberName.split(' (')[0].trim();
        if (nameOnly === name.split(' (')[0].trim()) {
          teamB.delete(userId);
          resetNames.push(name);
          break;
        }
      }
    }

    if (resetNames.length === 0) {
      bot.sendMessage(msg.chat.id, '⚠️ Không có member nào được reset.');
      return;
    }

    // Add reset members back to main list
    let addedCount = 0;
    resetNames.forEach(name => {
      const fakeId = Date.now() + Math.random() + addedCount;
      members.set(fakeId, name);
      addedCount++;
    });

    const message = `✅ Đã reset ${resetNames.length} member(s) từ Team B về list:\n${resetNames.join('\n')}`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });
};

module.exports = resetteam2Command;
