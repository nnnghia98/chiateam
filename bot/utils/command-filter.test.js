const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SUPPORTED_COMMANDS,
  normalizeCommandToken,
  isSupportedCommandText,
} = require('./command-filter');
const { REGISTERED_COMMANDS } = require('../commands/manifest');

test('supported commands mirror the commands registered by the bot', () => {
  assert.deepEqual([...SUPPORTED_COMMANDS].sort(), [...REGISTERED_COMMANDS].sort());
});

test('registered commands are accepted, including Telegram @mentions', () => {
  assert.equal(isSupportedCommandText('/start'), true);
  assert.equal(isSupportedCommandText('/start@chia_team_bot'), true);
  assert.equal(isSupportedCommandText('/match 42'), true);
});

test('unknown slash commands are ignored by the filter', () => {
  assert.equal(isSupportedCommandText('/unknown'), false);
  assert.equal(isSupportedCommandText('/leaderboard'), false);
  assert.equal(isSupportedCommandText('hello team'), false);
});

test('command tokens normalize bot mentions correctly', () => {
  assert.equal(normalizeCommandToken('/players@chia_team_bot'), '/players');
});
