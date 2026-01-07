const { REGISTER } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { addPlayer, getPlayerByUserId } = require('../../db/players');

const bot = require('../../bot');

const registerCommand = () => {
  bot.onText(/^\/register$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: REGISTER.instruction,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });

  bot.onText(/^\/register (\d+)$/, async (msg, match) => {
    const number = parseInt(match[1]);

    if (!number || number <= 0) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.invalidNumber,
        options: {
          parse_mode: 'Markdown',
        },
      });
      return;
    }

    try {
      // Check if player already exists
      const existingPlayer = await getPlayerByUserId(msg.from.id);
      console.log('existingPlayer', existingPlayer);
      if (existingPlayer) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: REGISTER.duplicateTeleId
            .replace('${teleId}', msg.from.id)
            .replace('${name}', existingPlayer.name)
            .replace('${number}', existingPlayer.number),
          options: {
            parse_mode: 'Markdown',
          },
        });

        return;
      }

      await addPlayer({
        userId: msg.from.id,
        name: msg.from.first_name,
        number,
      });
      const player = await getPlayerByUserId(msg.from.id);

      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.success
          .replace('${name}', player.name)
          .replace('${number}', player.number)
          .replace('${teleId}', player.user_id)
          .replace('${username}', player.username),
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (error) {
      console.error('Error registering player:', error);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.error,
      });
    }
  });
};

module.exports = registerCommand;
