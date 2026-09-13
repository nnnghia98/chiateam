const test = require('node:test');
const assert = require('node:assert/strict');
const { getCatalog, getEntry, BOOTSTRAP } = require('./catalog');

test('catalog maps Telegram topics separately from chat id', () => {
  assert.deepEqual(getEntry('CHAT_ID').services, ['telegram']);
  assert.match(getEntry('CHAT_ID').label.vi, /ID nhóm Telegram/);
  assert.match(
    getEntry('ANNOUNCEMENT_THREAD_ID').label.vi,
    /message_thread_id/
  );
  assert.equal(getEntry('ANNOUNCEMENT_THREAD_ID').apply, 'restart');
});

test('Zalo mode is an explicit enum for both delivery services', () => {
  const entry = getEntry('ZALO_MODE');
  assert.deepEqual(entry.options, ['polling', 'webhook']);
  assert.deepEqual(entry.services, ['zalo-polling', 'zalo-webhook']);
  assert.equal(entry.apply, 'restart');
});

test('catalog contains useful bilingual help and correct secret flags', () => {
  const catalog = getCatalog();
  assert.ok(catalog.length >= 35);
  const token = getEntry('ZALO_BOT_TOKEN');
  assert.equal(token.secret, true);
  assert.match(token.description.en, /Controls/);
  assert.match(token.description.vi, /Điều khiển/);
  assert.equal(getEntry('MANAGEMENT_ADMIN_TOKEN'), undefined);
  assert.equal(
    BOOTSTRAP.find(item => item.key === 'MANAGEMENT_ADMIN_TOKEN').secret,
    true
  );
});
