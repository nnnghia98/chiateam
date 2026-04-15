const { ME } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const bot = require('../../telegram-client');

const meCommand = () => {
  bot.onText(/^\/me$/, async msg => {
    const userId = msg.from.id;
    const name = msg.from.first_name || 'Không rõ';
    const username = msg.from.username || 'Chưa có';
    // Query player data from database
    const { getPlayerByUserId } = require('../../../api/routes/players');

    try {
      const player = await getPlayerByUserId(userId);
      const baseMessage = ME.buildMessage({ name, userId, username, player });
      const message = player ? baseMessage : `${baseMessage}${ME.notRegistered}`;

      sendMessage({
        msg,
        type: 'DEFAULT',
        message,
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error fetching player data:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: ME.buildMessageWithFetchError({ name, userId, username }),
        options: {
          parse_mode: 'Markdown',
        },
      });
    }
  });
};

module.exports = meCommand;
