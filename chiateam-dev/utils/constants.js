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
  '/vote',
  '/clearvote',
  '/san',
  '/clearsan',
  '/demvote',
  '/resetteam1',
  '/resetteam2',
];

const PATTERNS = {
  add: /^\/add$/,
  add_list: /^\/add\s*\[(.+)\]$/,
  add_me: /^\/addme$/,
};

module.exports = { COMMANDS, PATTERNS };
