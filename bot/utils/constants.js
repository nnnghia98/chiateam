const PATTERNS = {
  add: /^\/add$/,
  add_list: /^\/add\s+(.+)$/,
  add_me: /^\/addme$/,
  edit_bench: /^\/editbench$/,
  edit_bench_update: /^\/editbench\s+(\d+)\s+(.+)$/,
};

module.exports = { PATTERNS };
