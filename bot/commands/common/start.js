const { START } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const bot = require('../../telegram-client');

const START_COMMAND_PATTERN = /^\/start(?:@\w+)?(?:\s+.*)?$/;

function handleStartCommand(msg) {
  return sendMessage({
    msg,
    type: 'MAIN',
    message: START.help,
    options: START.options,
  });
}

const startCommand = () => {
  bot.onText(START_COMMAND_PATTERN, handleStartCommand);
};

module.exports = startCommand;
