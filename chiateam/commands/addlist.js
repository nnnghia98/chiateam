const addListCommand = (bot, members) => {
  bot.onText(/\/addlist\s*\[(.+)\]/, (msg, match) => {
    const rawNames = match[1];
    const namesToAdd = rawNames
      .split(',')
      .map(n => n.trim())
      .filter(n => n);

    if (namesToAdd.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Nhập list member để thêm. Ví dụ:\n`/addlist [Nghia, Nghia 1, Nghia 2]`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const existingNames = Array.from(members.values()).map(name =>
      name.toLowerCase()
    );

    let addedCount = 0;
    namesToAdd.forEach(name => {
      if (!existingNames.includes(name.toLowerCase())) {
        const fakeId = Date.now() + Math.random();
        members.set(fakeId, name);
        addedCount++;
      }
    });

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
