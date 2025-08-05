const { getChatId } = require('../../utils/chat');
const { SAN } = require('../../utils/messages');

const sanStrings = new Map();

function sanCommand(bot) {
  bot.onText(/^\/san(?:\s+(.+))?$/, (msg, match) => {
    const currentSan = sanStrings.get(getChatId(msg, 'DEFAULT'));

    const input = match[1] && match[1].trim();
    if (input) {
      if (currentSan) {
        bot.sendMessage(
          getChatId(msg, 'DEFAULT'),
          SAN.currentSan.replace('{value}', currentSan)
        );
      } else {
        sanStrings.set(getChatId(msg, 'DEFAULT'), input);
        bot.sendMessage(
          getChatId(msg, 'DEFAULT'),
          SAN.successSan.replace('{value}', input)
        );
      }
    } else {
      if (currentSan) {
        bot.sendMessage(getChatId(msg, 'ANNOUNCEMENT'), `Sân: ${currentSan}`);
      } else {
        bot.sendMessage(getChatId(msg, 'DEFAULT'), SAN.noSan);
      }
    }
  });

  bot.onText(/^\/clearsan$/, msg => {
    if (sanStrings.has(getChatId(msg, 'DEFAULT'))) {
      sanStrings.delete(getChatId(msg, 'DEFAULT'));
      bot.sendMessage(getChatId(msg, 'DEFAULT'), SAN.successDeleteSan);
    } else {
      bot.sendMessage(getChatId(msg, 'DEFAULT'), SAN.noSan);
    }
  });
}

module.exports = sanCommand;
