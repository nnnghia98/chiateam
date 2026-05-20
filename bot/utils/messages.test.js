const test = require('node:test');
const assert = require('node:assert/strict');

const { BENCH, CHIA_TEAM, START, TEAM } = require('./messages');

test('/start help is organized into concise sections', () => {
  assert.match(START.help, /\*BẮT ĐẦU NHANH\*/);
  assert.match(START.help, /\*DANH SÁCH LỆNH\*/);
  assert.match(START.help, /\*BENCH\*/);
  assert.match(START.help, /\*TEAM\*/);
  assert.match(START.help, /\*TRẬN ĐẤU\*/);
  assert.match(START.help, /\*CẦU THỦ\*/);
  assert.match(START.help, /\*ADMIN\*/);
});

test('/start help highlights the recommended command flow first', () => {
  const quickStartIndex = START.help.indexOf('*BẮT ĐẦU NHANH*');
  const commandListIndex = START.help.indexOf('*DANH SÁCH LỆNH*');

  assert.notEqual(quickStartIndex, -1);
  assert.notEqual(commandListIndex, -1);
  assert.ok(quickStartIndex < commandListIndex);
  assert.match(START.help, /\/addme.+\/bench.+\/chiateam.+\/team/s);
});

test('bench and team messages include roster counts', () => {
  assert.equal(
    BENCH.success.replace('{count}', 3).replace('{names}', '1. A\n2. B\n3. C'),
    '👥 Danh sách hiện tại:\n1. A\n2. B\n3. C\n\nTổng: 3 player(s)'
  );

  assert.match(
    TEAM.buildTwoTeamMessage(['A'], ['B', 'C']),
    /\*HOME \(1\):\*[\s\S]+\*AWAY \(2\):\*/
  );

  assert.match(
    TEAM.buildThreeTeamMessage(['A'], ['B'], ['C', 'D']),
    /\*HOME \(1\):\*[\s\S]+\*AWAY \(1\):\*[\s\S]+\*EXT \(2\):\*/
  );

  assert.match(
    CHIA_TEAM.buildThreeTeamMessage(['A', 'B'], ['C'], ['D']),
    /\*HOME \(2\):\*[\s\S]+\*AWAY \(1\):\*[\s\S]+\*EXT \(1\):\*/
  );
});
