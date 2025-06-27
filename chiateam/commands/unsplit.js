const unSplitCommand = (bot, members, lastMembersBeforeSplit) => {
  bot.onText(/\/unsplit/, msg => {
    if (lastMembersBeforeSplit.size === 0) {
      bot.sendMessage(
        msg.chat.id,
        '⚠️ Không có danh sách trước đó để khôi phục'
      );
      return;
    }

    members.clear();
    for (const [id, name] of lastMembersBeforeSplit) {
      members.set(id, name);
    }

    bot.sendMessage(
      msg.chat.id,
      '✅ Danh sách đã được khôi phục đến trạng thái trước khi chia'
    );
  });
};

module.exports = unSplitCommand;
