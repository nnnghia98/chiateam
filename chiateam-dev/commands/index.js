const startCommand = require('./common/start');
const addMeCommand = require('./before-match/add-me');
const addCommand = require('./before-match/add');
const listCommand = require('./list/list');
const chiateamCommand = require('./team/chia-team');
const teamCommand = require('./team/team');
const removeCommand = require('./list/remove');
const resetCommand = require('./list/reset');
const addToTeam1Command = require('./before-match/add-to-team-1');
const addToTeam2Command = require('./before-match/add-to-team-2');
const resetTeamCommand = require('./team/reset-team');
const unknownCommand = require('./common/unknown');
const tiensanCommand = require('./after-match/tien-san');
const chiaTienCommand = require('./after-match/chia-tien');
const taoVoteCommand = require('./before-match/tao-vote');
const leaderboardCommand = require('./leaderboard/leaderboard');
const updateLeaderboardCommand = require('./leaderboard/update-leaderboard');
const editStatsCommand = require('./leaderboard/edit-stats');
const playerCommand = require('./leaderboard/player');
const sanCommand = require('./before-match/san');
const resetTeam1Command = require('./team/reset-team-1');
const resetTeam2Command = require('./team/reset-team-2');

module.exports = {
  startCommand,
  addMeCommand,
  addCommand,
  listCommand,
  chiateamCommand,
  teamCommand,
  removeCommand,
  resetCommand,
  addToTeam1Command,
  addToTeam2Command,
  resetTeamCommand,
  unknownCommand,
  tiensanCommand,
  chiaTienCommand,
  taoVoteCommand,
  leaderboardCommand,
  updateLeaderboardCommand,
  editStatsCommand,
  playerCommand,
  sanCommand,
  resetTeam1Command,
  resetTeam2Command,
};
