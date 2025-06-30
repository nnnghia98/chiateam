const { isValidName } = require('../utils/validate');

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
      if (!isValidName(targetToRemove)) {
        bot.sendMessage(msg.chat.id, '⚠️ Tên không hợp lệ.');
        return;
      }

      // Remove by name (exact case-sensitive match)
      for (const [userId, name] of members) {
        // Extract just the name part (before any @username)
        const nameOnly = name.split(' (')[0].trim();

        if (nameOnly === targetToRemove) {
          members.delete(userId);
          bot.sendMessage(msg.chat.id, `❌ Đã cút *${name}* khỏi /list`, {
            parse_mode: 'Markdown',
          });
          removed = true;
          break; // Remove only first match
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
