const { isValidName, isDuplicateName } = require('../../utils/validate');

const addListCommand = (bot, members) => {
  // Show usage if /add is called without arguments
  bot.onText(/\/add$/, msg => {
    bot.sendMessage(
      msg.chat.id,
      '📋 *Cách sử dụng /add:*\n' +
        '• `/add [name 1, name 2, name 3, ...]` - Thêm nhiều member vào list cùng lúc\n' +
        '\nVí dụ: `/add [Nghia, Nghia 1, Nghia 2]`',
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/add\s*\[(.+)\]/, (msg, match) => {
    const rawNames = match[1];
    const namesToAdd = rawNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n);

    if (namesToAdd.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Nhập list member để thêm. Ví dụ:\n`/add [Nghia, Nghia 1, Nghia 2]`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const allNames = Array.from(members.values());
    let addedCount = 0;
    const invalidNames = [];
    namesToAdd.forEach(name => {
      if (!isValidName(name)) {
        invalidNames.push(name);
        return;
      }
      if (!isDuplicateName(name, allNames)) {
        const fakeId = Date.now() + Math.random();
        members.set(fakeId, name);
        allNames.push(name); // update for next duplicate check
        addedCount++;
      }
    });

    if (invalidNames.length > 0) {
      bot.sendMessage(
        msg.chat.id,
        `⚠️ Các tên không hợp lệ (bị bỏ qua): ${invalidNames.join(', ')}`
      );

      return;
    }

    if (addedCount === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Không có member mới được thêm. Tất cả member đã có trong /list'
      );
    } else {
      bot.sendMessage(
        msg.chat.id,
        `✅ Đã thêm ${addedCount} member(s) vào /list`
      );
    }
  });
};

module.exports = addListCommand;
