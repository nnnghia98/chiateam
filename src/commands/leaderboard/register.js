const { sendMessage } = require('../../utils/chat');
const {
  addPlayer,
  getPlayerByTeleId,
  getPlayerByNumber,
} = require('../../db/player');
const { isValidName } = require('../../utils/validate');
const { REGISTER } = require('../../utils/messages');
const bot = require('../../bot');

const registerCommand = () => {
  // Handle /register without parameters
  bot.onText(/^\/register$/, async msg => {
    sendMessage(msg, 'DEFAULT', REGISTER.instruction, {
      parse_mode: 'Markdown',
    });
  });

  // Handle /register with parameters
  bot.onText(/^\/register (.+)$/, async (msg, match) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = msg.from.username;
      console.log('===', userId, username);

      // Check if parameters are provided
      if (!match[1]) {
        sendMessage(msg, 'DEFAULT', REGISTER.instruction, {
          parse_mode: 'Markdown',
        });
        return;
      }

      // const params = match[1].trim().split(/\s+/);

      // if (params.length < 2) {
      //   sendMessage(msg, 'DEFAULT', REGISTER.warning, {
      //     parse_mode: 'Markdown',
      //   });
      //   return;
      // }

      // // Parse parameters
      // const number = parseInt(params[0]);
      // const name = params.slice(1, -2).join(' '); // All middle parts except last 2
      // const providedTeleId =
      //   params.length >= 4 ? parseInt(params[params.length - 2]) : null;
      // const providedUsername =
      //   params.length >= 4 ? params[params.length - 1] : null;

      // // Validate number
      // if (isNaN(number) || number <= 0) {
      //   sendMessage(msg, 'DEFAULT', REGISTER.invalidNumber, {
      //     parse_mode: 'Markdown',
      //   });
      //   return;
      // }

      // // Validate name
      // if (!name || !isValidName(name)) {
      //   sendMessage(msg, 'DEFAULT', REGISTER.invalidName, {
      //     parse_mode: 'Markdown',
      //   });
      //   return;
      // }

      // // Use provided values or fallback to chat user info
      // const finalTeleId = providedTeleId || userId;
      // const finalUsername = providedUsername || username;

      // // Check if player already exists with this number
      // try {
      //   const existingPlayerByNumber = await getPlayerByNumber(number);
      //   if (existingPlayerByNumber) {
      //     sendMessage(
      //       msg,
      //       'DEFAULT',
      //       REGISTER.duplicateNumber
      //         .replace('${number}', number)
      //         .replace('${name}', existingPlayerByNumber.name),
      //       { parse_mode: 'Markdown' }
      //     );
      //     return;
      //   }
      // } catch (error) {
      //   console.error('Error checking existing player by number:', error);
      // }

      // // Check if player already exists with this Telegram ID
      // try {
      //   const existingPlayerByTeleId = await getPlayerByTeleId(finalTeleId);
      //   if (existingPlayerByTeleId) {
      //     sendMessage(
      //       msg,
      //       'DEFAULT',
      //       REGISTER.duplicateTeleId
      //         .replace('${teleId}', finalTeleId)
      //         .replace('${name}', existingPlayerByTeleId.name)
      //         .replace('${number}', existingPlayerByTeleId.number),
      //       { parse_mode: 'Markdown' }
      //     );
      //     return;
      //   }
      // } catch (error) {
      //   console.error('Error checking existing player by Telegram ID:', error);
      // }

      // // Add new player
      // try {
      //   const newPlayer = await addPlayer(
      //     finalTeleId,
      //     name,
      //     number,
      //     finalUsername
      //   );

      //   sendMessage(
      //     msg,
      //     'DEFAULT',
      //     REGISTER.success
      //       .replace('${name}', newPlayer.name)
      //       .replace('${number}', newPlayer.number)
      //       .replace('${teleId}', newPlayer.tele_id)
      //       .replace('${username}', newPlayer.username || 'Không có'),
      //     { parse_mode: 'Markdown' }
      //   );
      // } catch (error) {
      //   console.error('Error adding player:', error);
      //   sendMessage(msg, 'DEFAULT', REGISTER.error, {
      //     parse_mode: 'Markdown',
      //   });
      // }
    } catch (error) {
      console.error('Error in register command:', error);
      sendMessage(msg, 'DEFAULT', REGISTER.error, {
        parse_mode: 'Markdown',
      });
    }
  });
};

module.exports = registerCommand;
