const { REGISTER } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const { requireAdmin } = require('../../utils/permissions');
const {
  registerPlayer,
  registerPlayerForAnother,
  deletePlayerByNumber,
} = require('../../services/player-service');

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

  // /register NUMBER DELETE – admin only: delete player by shirt number
  bot.onText(/^\/register (\d+) DELETE$/i, async (msg, match) => {
    if (!msg?.from) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.needPrivateChat,
        options: { parse_mode: 'Markdown' },
      });
      return;
    }
    if (!requireAdmin(msg)) return;
    const number = parseInt(match[1], 10);
    try {
      const result = await deletePlayerByNumber(number);
      if (result.ok) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: REGISTER.deleteSuccess.replace('${number}', number),
          options: { parse_mode: 'Markdown' },
        });
      } else if (result.code === 'NOT_FOUND') {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: REGISTER.deleteNotFound.replace('${number}', number),
          options: { parse_mode: 'Markdown' },
        });
      } else {
        sendMessage({ msg, type: 'DEFAULT', message: REGISTER.error });
      }
    } catch (err) {
      console.error('Error deleting player:', err);
      sendMessage({ msg, type: 'DEFAULT', message: REGISTER.error });
    }
  });

  bot.onText(/^\/register (\d+)$/, async (msg, match) => {
    if (!msg?.from) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.needPrivateChat,
        options: {
          parse_mode: 'Markdown',
        },
      });
      return;
    }

    try {
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
          case 'INVALID_NAME':
            sendMessage({
              msg,
              type: 'DEFAULT',
              message: REGISTER.invalidName,
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
            console.error('Error registering player:', result.error ?? result);
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
          .replace('${username}', player.username ?? 'Chưa có'),
        options: {
          parse_mode: 'Markdown',
        },
      });
    } catch (err) {
      console.error('Error registering player:', err);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.error,
      });
    }
  });

  // /register NAME NUMBER – admin only: register a slot for another person
  bot.onText(/^\/register (.+) (\d+)$/, async (msg, match) => {
    if (!msg?.from) {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: REGISTER.needPrivateChat,
        options: { parse_mode: 'Markdown' },
      });
      return;
    }
    if (!requireAdmin(msg)) return;
    const name = match[1].trim();
    const number = parseInt(match[2], 10);
    try {
      const result = await registerPlayerForAnother({ name, number });
      if (result.ok) {
        const player = result.player;
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: REGISTER.registeredForAnotherSuccess
            .replace('${name}', player.name)
            .replace('${number}', player.number),
          options: { parse_mode: 'Markdown' },
        });
      } else {
        switch (result.code) {
          case 'INVALID_NAME':
            sendMessage({
              msg,
              type: 'DEFAULT',
              message: REGISTER.invalidName,
              options: { parse_mode: 'Markdown' },
            });
            return;
          case 'INVALID_NUMBER':
            sendMessage({
              msg,
              type: 'DEFAULT',
              message: REGISTER.invalidNumber,
              options: { parse_mode: 'Markdown' },
            });
            return;
          case 'NUMBER_IN_USE': {
            const player = result.data.player;
            sendMessage({
              msg,
              type: 'DEFAULT',
              message: REGISTER.duplicateNumber
                .replace('${number}', player.number)
                .replace('${name}', player.name),
              options: { parse_mode: 'Markdown' },
            });
            return;
          }
          default:
            sendMessage({ msg, type: 'DEFAULT', message: REGISTER.error });
        }
      }
    } catch (err) {
      console.error('Error registering for another:', err);
      sendMessage({ msg, type: 'DEFAULT', message: REGISTER.error });
    }
  });

  // /register with extra or invalid args (e.g. /register 10 Nghia) -> show instruction
  bot.onText(/^\/register\s+.+$/, msg => {
    sendMessage({
      msg,
      type: 'DEFAULT',
      message: REGISTER.instruction,
      options: {
        parse_mode: 'Markdown',
      },
    });
  });
};

module.exports = registerCommand;
