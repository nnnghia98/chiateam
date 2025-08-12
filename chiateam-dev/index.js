const {
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
} = require('./commands');

const members = new Map();

const teamA = new Map();
const teamB = new Map();

let tiensan = null;

startCommand();
unknownCommand();
addMeCommand(members);
chiateamCommand(members, teamA, teamB);
resetTeamCommand(members, teamA, teamB);
listCommand(members);
removeCommand(members);
resetCommand(members);
addCommand(members);
teamCommand(teamA, teamB);
tiensanCommand(
  () => tiensan,
  val => {
    tiensan = val;
  }
);
chiaTienCommand(() => tiensan, teamA, teamB);
taoVoteCommand();
addToTeam1Command(members, teamA);
addToTeam2Command(members, teamB);
sanCommand();
leaderboardCommand();
updateLeaderboardCommand();
editStatsCommand();
playerCommand();
resetTeam1Command(teamA, members);
resetTeam2Command(teamB, members);

console.log('🤖 Bot is running...');
