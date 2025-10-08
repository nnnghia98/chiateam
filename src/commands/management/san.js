const { sendMessage, CHAT_ID } = require('../../utils/chat');
const { SAN } = require('../../utils/messages');

const sanStrings = new Map();

const bot = require('../../bot');

function sanCommand() {
  bot.onText(/^\/san(?:\s+(.+))?$/, (msg, match) => {
    const currentSan = sanStrings.get(CHAT_ID);

    const input = match[1] && match[1].trim();
    if (input) {
      if (currentSan) {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: SAN.currentSan.replace('{value}', currentSan),
        });
      } else {
        sanStrings.set(CHAT_ID, input);
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: SAN.successSan.replace('{value}', input),
        });
      }
    } else {
      if (currentSan) {
        sendMessage({
          msg,
          type: 'ANNOUNCEMENT',
          message: `Sân: ${currentSan}`,
        });
      } else {
        sendMessage({
          msg,
          type: 'DEFAULT',
          message: SAN.noSan,
        });
      }
    }
  });

  bot.onText(/^\/clearsan$/, msg => {
    if (sanStrings.has(CHAT_ID)) {
      sanStrings.delete(CHAT_ID);
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: SAN.successDeleteSan,
      });
    } else {
      sendMessage({
        msg,
        type: 'DEFAULT',
        message: SAN.noSan,
      });
    }
  });
}

module.exports = sanCommand;
