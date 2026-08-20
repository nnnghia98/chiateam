const {
  listSupportedCommandNames,
} = require('../../core/commands/command-manifest');

const REGISTERED_COMMANDS = Object.freeze(listSupportedCommandNames());

module.exports = {
  REGISTERED_COMMANDS,
};
