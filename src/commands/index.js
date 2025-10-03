const startCommand = require('./common/start');
const addMeCommand = require('./add/add-me');
const addCommand = require('./add/add');
const benchCommand = require('./bench/bench');
const chiateamCommand = require('./team/chia-team');
const teamCommand = require('./team/team');
const clearBenchCommand = require('./bench/clear-bench');
const unknownCommand = require('./common/unknown');
const tiensanCommand = require('./management/tien-san');
const chiaTienCommand = require('./management/chia-tien');
const taoVoteCommand = require('./management/tao-vote');
const leaderboardCommand = require('./leaderboard/leaderboard');
const updateLeaderboardCommand = require('./leaderboard/update-leaderboard');
const editStatsCommand = require('./leaderboard/edit-stats');
const playerCommand = require('./leaderboard/player');
const registerCommand = require('./player/register');
const sanCommand = require('./management/san');
const addToTeamCommand = require('./team/add-to-team');
const clearTeamCommand = require('./team/clear-team');

module.exports = {
  startCommand,
  addMeCommand,
  addCommand,
  benchCommand,
  chiateamCommand,
  teamCommand,
  clearBenchCommand,
  unknownCommand,
  tiensanCommand,
  chiaTienCommand,
  taoVoteCommand,
  leaderboardCommand,
  updateLeaderboardCommand,
  editStatsCommand,
  playerCommand,
  registerCommand,
  sanCommand,
  addToTeamCommand,
  clearTeamCommand,
};
