const { sendMessage, CHAT_ID } = require('../../utils/chat');
const { SAN } = require('../../utils/messages');
const { requireAdmin } = require('../../utils/permissions');

const sanStrings = new Map();

const bot = require('../../telegram-client');

function getSan() {
  return sanStrings.get(CHAT_ID) || null;
}

function setSan(value) {
  const venue = typeof value === 'string' ? value.trim() : '';

  if (venue) {
    sanStrings.set(CHAT_ID, venue);
  } else {
    sanStrings.delete(CHAT_ID);
  }
}

function sanCommand({
  getSan: readSan = getSan,
  setSan: writeSan = setSan,
  registerSanCommand = true,
  registerClearCommand = true,
} = {}) {
  if (typeof readSan !== 'function' || typeof writeSan !== 'function') {
    throw new TypeError(
      'san command requires venue getter and setter functions.'
    );
  }

  if (registerSanCommand) {
    bot.onText(/^\/san(?:\s+(.+))?$/, async (msg, match) => {
      const currentSan = readSan();

      const input = match[1] && match[1].trim();
      if (input) {
        if (currentSan) {
          sendMessage({
            msg,
            type: 'DEFAULT',
            message: SAN.currentSan.replace('{value}', currentSan),
          });
        } else {
          await writeSan(input);
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
            message: SAN.currentAnnouncement.replace('{value}', currentSan),
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
  }

  if (registerClearCommand) {
    bot.onText(/^\/clearsan$/, async msg => {
      if (!requireAdmin(msg)) {
        return;
      }

      if (readSan()) {
        await writeSan(null);
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
}

module.exports = sanCommand;
module.exports.getSan = getSan;
module.exports.setSan = setSan;
