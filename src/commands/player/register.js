const { REGISTER } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { registerPlayer } = require('../../services/player-service');

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
    const number = parseInt(match[1], 10);

    const result = await registerPlayer({
      teleUser: msg.from,
      number,
    });

    if (!result.ok) {
      switch (result.code) {
        case 'INVALID_NUMBER':
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: REGISTER.invalidNumber,
            options: {
              parse_mode: 'Markdown',
            },
          });
          return;
        case 'ALREADY_REGISTERED': {
          const player = result.data.player;
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: REGISTER.duplicateUserId
              .replace('${teleId}', player.user_id)
              .replace('${name}', player.name)
              .replace('${number}', player.number),
            options: {
              parse_mode: 'Markdown',
            },
          });
          return;
        }
        case 'NUMBER_IN_USE': {
          const player = result.data.player;
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: REGISTER.duplicateNumber
              .replace('${number}', player.number)
              .replace('${name}', player.name),
            options: {
              parse_mode: 'Markdown',
            },
          });
          return;
        }
        default:
          // UNEXPECTED_ERROR or other unknown codes
          console.error('Error registering player:', result.error);
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: REGISTER.error,
          });
          return;
      }
    }

    const player = result.player;

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
  });
};

module.exports = registerCommand;
