const { REGISTERED_COMMANDS } = require('../commands/manifest');

const SUPPORTED_COMMANDS = new Set(REGISTERED_COMMANDS);

function getCommandToken(text) {
  if (typeof text !== 'string') return null;

  const token = text.trim().split(/\s+/)[0];
  if (!token || !token.startsWith('/')) return null;

  return token;
}

function normalizeCommandToken(token) {
  if (typeof token !== 'string' || !token) return null;

  const [command] = token.split('@');
  return command || null;
}

function isSupportedCommandText(text) {
  const commandToken = getCommandToken(text);
  if (!commandToken) return false;

  const command = normalizeCommandToken(commandToken);
  return command ? SUPPORTED_COMMANDS.has(command) : false;
}

module.exports = {
  SUPPORTED_COMMANDS,
  getCommandToken,
  normalizeCommandToken,
  isSupportedCommandText,
};
