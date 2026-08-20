const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiMatchRepository } = require('./api-match-repository');

test('API match repository maps neutral operations to current routes', async () => {
  const calls = [];
  const repository = createApiMatchRepository({
    async getByDate(date) {
      calls.push(['find', date]);
    },
    async getWithPlayers(date) {
      calls.push(['detail', date]);
    },
    async saveMatch(draft) {
      calls.push(['save', draft]);
    },
    async setScore(...args) {
      calls.push(['score', ...args]);
    },
    async removeByDate(date) {
      calls.push(['delete', date]);
    },
    async getList(limit, offset) {
      calls.push(['list', limit, offset]);
    },
    async hasPlayer(...args) {
      calls.push(['contains', ...args]);
    },
    async addStat(...args) {
      calls.push(['stat', ...args]);
    },
    async setPlayerMvp(...args) {
      calls.push(['mvp', ...args]);
    },
  });
  const draft = { matchDate: '2026-08-06' };

  await repository.findByDate('2026-08-06');
  await repository.findWithPlayers('2026-08-06');
  await repository.save(draft);
  await repository.updateScore('2026-08-06', 3, 1);
  await repository.deleteByDate('2026-08-06');
  await repository.list(10, 20);
  await repository.containsPlayer(1, 2);
  await repository.addPlayerStat(1, 2, 'goals', 3);
  await repository.setMvp(1, 2);

  assert.deepEqual(calls, [
    ['find', '2026-08-06'],
    ['detail', '2026-08-06'],
    ['save', draft],
    ['score', '2026-08-06', 3, 1],
    ['delete', '2026-08-06'],
    ['list', 10, 20],
    ['contains', 1, 2],
    ['stat', 1, 2, 'goals', 3],
    ['mvp', 1, 2],
  ]);
});
