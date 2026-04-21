const test = require('node:test');
const assert = require('node:assert/strict');

const { START } = require('./messages');

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
