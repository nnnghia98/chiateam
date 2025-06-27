const removeCommand = (bot, members) => {
  bot.onText(/\/remove (.+)/, (msg, match) => {
    const targetToRemove = match[1].trim();

    if (!targetToRemove) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Nhập tên member cho cút. Ví dụ:\n`/remove Nghia` hoặc `/remove @123456789`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let removed = false;

    // Check if it's a user ID (starts with @)
    if (targetToRemove.startsWith('@')) {
      const userId = parseInt(targetToRemove.substring(1));
      if (isNaN(userId)) {
        bot.sendMessage(
          msg.chat.id,
          '⚠️ User ID không hợp lệ. Ví dụ: `/remove @123456789`',
          {
            parse_mode: 'Markdown',
          }
        );
        return;
      }

      if (members.has(userId)) {
        const name = members.get(userId);
        members.delete(userId);
        bot.sendMessage(msg.chat.id, `❌ Đã cút *${name}* khỏi /list`, {
          parse_mode: 'Markdown',
        });
        removed = true;
      }
    } else {
      // Remove by name (existing logic)
      const nameToRemove = targetToRemove.toLowerCase();
      for (const [userId, name] of members) {
        if (name.toLowerCase().includes(nameToRemove)) {
          members.delete(userId);
          bot.sendMessage(msg.chat.id, `❌ Đã cút *${name}* khỏi /list`, {
            parse_mode: 'Markdown',
          });
          removed = true;
          break; // Remove only first match, adjust if you want to remove all
        }
      }
    }

    if (!removed) {
      if (targetToRemove.startsWith('@')) {
        bot.sendMessage(
          msg.chat.id,
          `⚠️ Không tìm thấy user ID "${targetToRemove}" trong /list`
        );
      } else {
        bot.sendMessage(
          msg.chat.id,
          `⚠️ Không tìm thấy member "${targetToRemove}"`
        );
      }
    }
  });
};

module.exports = removeCommand;
