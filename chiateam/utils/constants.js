const COMMANDS = [
  '/start',
  '/addme',
  '/add',
  '/chiateam',
  '/list',
  '/addtoteam1',
  '/addtoteam2',
  '/team',
  '/remove',
  '/reset',
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
  '/leaderboard',
  '/update-leaderboard',
  '/player',
  '/edit-stats',
];

const PATTERNS = {
  add: /^\/add$/,
  add_list: /^\/add\s*\[(.+)\]$/,
  add_me: /^\/addme$/,
};

module.exports = { COMMANDS, PATTERNS };
