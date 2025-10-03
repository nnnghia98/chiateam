const startCommand = require('./common/start');
const addMeCommand = require('./add/add-me');
const addCommand = require('./add/add');
const benchCommand = require('./bench/bench');
const chiateamCommand = require('./team/chia-team');
const teamCommand = require('./team/team');
const removeCommand = require('./bench/remove');
const clearBenchCommand = require('./clear/clear-bench');
const unknownCommand = require('./common/unknown');
const tiensanCommand = require('./after-match/tien-san');
const chiaTienCommand = require('./after-match/chia-tien');
const taoVoteCommand = require('./add/tao-vote');
const leaderboardCommand = require('./leaderboard/leaderboard');
const updateLeaderboardCommand = require('./leaderboard/update-leaderboard');
const editStatsCommand = require('./leaderboard/edit-stats');
const playerCommand = require('./leaderboard/player');
const registerCommand = require('./leaderboard/register');
const sanCommand = require('./add/san');
const addToTeamCommand = require('./add/add-to-team');
const clearTeamCommand = require('./clear/clear-team');

module.exports = {
  startCommand,
  addMeCommand,
  addCommand,
  benchCommand,
  chiateamCommand,
  teamCommand,
  removeCommand,
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
