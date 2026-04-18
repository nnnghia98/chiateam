const { START } = require('../../utils/messages');
const { sendMessage } = require('../../utils/chat');
const bot = require('../../telegram-client');

const START_COMMAND_PATTERN = /^\/start(?:@\w+)?(?:\s+.*)?$/;
const START_MESSAGE_OPTIONS = Object.freeze({ parse_mode: 'Markdown' });

function handleStartCommand(msg) {
  return sendMessage({
    msg,
    type: 'MAIN',
    message: START.help,
    options: START_MESSAGE_OPTIONS,
  });
}

const startCommand = () => {
  bot.onText(START_COMMAND_PATTERN, handleStartCommand);
};

module.exports = startCommand;
