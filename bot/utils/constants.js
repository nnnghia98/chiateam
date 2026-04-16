const COMMANDS = [
  '/start',
  '/addme',
  '/add',
  '/chiateam',
  '/bench',
  '/team',
  '/clearbench',
  '/tiensan',
  '/chiatien',
  '/taovote',
  '/clearvote',
  '/demvote',
  '/sync',
  '/san',
  '/clearsan',
  '/clearteam',
  '/players',
  '/player',
  '/edit-stats',
  '/register',
  '/addtoteam',
  '/me',
  '/match',
  '/matches',
  '/reset',
];

const PATTERNS = {
  add: /^\/add$/,
  add_list: /^\/add\s+(.+)$/,
  add_me: /^\/addme$/,
};

module.exports = { COMMANDS, PATTERNS };
