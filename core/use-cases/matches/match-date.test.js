const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatDisplayDate,
  getThursdayDate,
  parseDisplayDate,
} = require('./match-date');

test('match date parses and formats valid calendar dates', () => {
  assert.equal(parseDisplayDate('6/8/2026'), '2026-08-06');
  assert.equal(formatDisplayDate('2026-08-06'), '06/08/2026');
  assert.equal(parseDisplayDate('31/04/2026'), null);
  assert.equal(parseDisplayDate('01/13/2026'), null);
});

test('match date selects Thursday from the current local week', () => {
  assert.equal(getThursdayDate(new Date(2026, 7, 6, 12)), '2026-08-06');
  assert.equal(getThursdayDate(new Date(2026, 7, 8, 12)), '2026-08-06');
  assert.equal(getThursdayDate(new Date(2026, 7, 3, 12)), '2026-07-30');
});
