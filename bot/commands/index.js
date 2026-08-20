const callbackQueryCommand = require('./common/callback-query');
const taoVoteCommand = require('./management/tao-vote');
const { REGISTERED_COMMANDS } = require('./command-registry');

module.exports = {
  callbackQueryCommand,
  taoVoteCommand,
  REGISTERED_COMMANDS,
};
