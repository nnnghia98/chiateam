const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildZaloGreeting,
  createZaloGreetingResult,
} = require('./zalo-greeting');

test('Zalo greeting keeps configured text and adds icon quick links', () => {
  const result = createZaloGreetingResult(
    { displayName: 'Nghia' },
    { ZALO_GREETING_TEXT: 'Xin chào {name}!' }
  );
  const text = result.messages[0].text;

  assert.match(text, /^Xin chào Nghia!/);
  assert.match(text, /🔔 \/subscribe — Nhận thông báo của đội/);
  assert.match(text, /🗳️ \/poll — Xem vote đang mở/);
  assert.match(text, /⚽ \/team — Xem đội hình/);
  assert.match(text, /📚 \/start — Xem tất cả lệnh$/);
  assert.equal(buildZaloGreeting({ displayName: 'Nghia' }, { ZALO_GREETING_TEXT: 'Xin chào {name}!' }), 'Xin chào Nghia!');
});
