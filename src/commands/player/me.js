const { sendMessage } = require('../../utils/chat');
const bot = require('../../bot');

const meCommand = () => {
  bot.onText(/^\/me$/, async msg => {
    const userId = msg.from.id;
    const name = msg.from.first_name || 'Không rõ';
    const username = msg.from.username || 'Chưa có';
    let message = `👤 **Thông tin của bạn:**

**Tên:** ${name}
**ID:** ${userId}
**Username:** @${username}`;

    // Query player data from database
    const { getPlayerByUserId } = require('../../db/players');

    try {
      const player = await getPlayerByUserId(userId);

      if (player) {
        message += `\n\n⚽ **Thông tin cầu thủ:**
**Số áo:** ${player.number}
**Bàn thắng:** ${player.goal || 0}
**Kiến tạo:** ${player.assist || 0}`;
      } else {
        message +=
          '\n\n⚠️ Bạn chưa đăng ký làm cầu thủ. Sử dụng "/register" để đăng ký.';
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      message += '\n\n❌ Có lỗi xảy ra khi lấy thông tin cầu thủ.';
    }
    sendMessage({
      msg,
      type: 'DEFAULT',
      message,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = meCommand;
