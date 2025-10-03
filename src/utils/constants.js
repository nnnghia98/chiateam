const COMMANDS = [
  '/start',
  '/addme',
  '/add',
  '/chiateam',
  '/bench',
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
  '/clearteam',
  '/leaderboard',
  '/update-leaderboard',
  '/player',
  '/edit-stats',
  '/register',
  '/addtoteam',
];

const PATTERNS = {
  add: /^\/add$/,
  add_list: /^\/add\s+(.+)$/,
  add_me: /^\/addme$/,
};

module.exports = { COMMANDS, PATTERNS };
