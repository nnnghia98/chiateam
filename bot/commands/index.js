const startCommand = require('./common/start');
const addMeCommand = require('./add/add-me');
const addCommand = require('./add/add');
const benchCommand = require('./bench/bench');
const editBenchCommand = require('./bench/edit-bench');
const chiateamCommand = require('./team/chia-team');
const teamCommand = require('./team/team');
const clearBenchCommand = require('./bench/clear-bench');
const tiensanCommand = require('./management/tien-san');
const chiaTienCommand = require('./management/chia-tien');
const taoVoteCommand = require('./management/tao-vote');
const editStatsCommand = require('./leaderboard/edit-stats');
const playerCommand = require('./leaderboard/player');
const registerCommand = require('./player/register');
const playersCommand = require('./player/players');
const sanCommand = require('./management/san');
const addToTeamCommand = require('./team/add-to-team');
const clearTeamCommand = require('./team/clear-team');
const meCommand = require('./player/me');
const matchCommand = require('./match/match');
const matchesCommand = require('./match/matches');
const resetCommand = require('./management/reset');
const { REGISTERED_COMMANDS } = require('./manifest');

module.exports = {
  startCommand,
  addMeCommand,
  addCommand,
  benchCommand,
  editBenchCommand,
  chiateamCommand,
  teamCommand,
  clearBenchCommand,
  tiensanCommand,
  chiaTienCommand,
  taoVoteCommand,
  editStatsCommand,
  playerCommand,
  registerCommand,
  playersCommand,
  sanCommand,
  addToTeamCommand,
  clearTeamCommand,
  meCommand,
  matchCommand,
  matchesCommand,
  resetCommand,
  REGISTERED_COMMANDS,
};
