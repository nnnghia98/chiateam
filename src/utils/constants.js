const COMMANDS = [
  '/start',
  '/addme',
  '/add',
  '/chiateam',
  '/bench',
  '/addtoteam1',
  '/addtoteam2',
  '/team',
  '/remove',
  '/clearbench',
  '/resetteam',
  '/tiensan',
  '/chiatien',
  '/taovote',
  '/clearvote',
  '/demvote',
  '/san',
  '/clearsan',
  '/resetteam1',
  '/resetteam2',
  '/clearteam',
  '/leaderboard',
  '/update-leaderboard',
  '/player',
  '/edit-stats',
  '/register',
  '/addtoteam',
  '/clearteam',
];

const PATTERNS = {
  add: /^\/add$/,
  add_list: /^\/add\s+(.+)$/,
  add_me: /^\/addme$/,
};

module.exports = { COMMANDS, PATTERNS };
