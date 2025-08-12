const { sendMessage, getChatId } = require('../../utils/chat');
const { SAN } = require('../../utils/messages');

const sanStrings = new Map();

const bot = require('../../bot');

function sanCommand() {
  bot.onText(/^\/san(?:\s+(.+))?$/, (msg, match) => {
    const currentSan = sanStrings.get(getChatId(msg, 'DEFAULT'));

    const input = match[1] && match[1].trim();
    if (input) {
      if (currentSan) {
        sendMessage(
          msg,
          'DEFAULT',
          SAN.currentSan.replace('{value}', currentSan)
        );
      } else {
        sanStrings.set(getChatId(msg, 'DEFAULT'), input);
        sendMessage(msg, 'DEFAULT', SAN.successSan.replace('{value}', input));
      }
    } else {
      if (currentSan) {
        sendMessage(msg, 'ANNOUNCEMENT', `Sân: ${currentSan}`);
      } else {
        sendMessage(msg, 'DEFAULT', SAN.noSan);
      }
    }
  });

  bot.onText(/^\/clearsan$/, msg => {
    if (sanStrings.has(getChatId(msg, 'DEFAULT'))) {
      sanStrings.delete(getChatId(msg, 'DEFAULT'));
      sendMessage(msg, 'DEFAULT', SAN.successDeleteSan);
    } else {
      sendMessage(msg, 'DEFAULT', SAN.noSan);
    }
  });
}

module.exports = sanCommand;
