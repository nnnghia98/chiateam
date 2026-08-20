const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApiStatisticsRepository,
} = require('./api-statistics-repository');

test('API statistics repository maps neutral operations to current services', async () => {
  const calls = [];
  const repository = createApiStatisticsRepository({
    async getOne(number) {
      calls.push(['getOne', number]);
      return null;
    },
    async getMany(numbers) {
      calls.push(['getMany', numbers]);
      return [];
    },
    async replace(...args) {
      calls.push(['replace', ...args]);
    },
    async addGoals(input) {
      calls.push(['goals', input]);
    },
    async addAssists(input) {
      calls.push(['assists', input]);
    },
  });

  await repository.findByNumber(10);
  await repository.findMany([10, 11]);
  await repository.replaceTotals(10, {
    matches: 5,
    wins: 3,
    losses: 1,
    draws: 1,
  });
  await repository.incrementGoals(10, 2);
  await repository.incrementAssists(10, 1);

  assert.deepEqual(calls, [
    ['getOne', 10],
    ['getMany', [10, 11]],
    ['replace', 10, 5, 3, 1, 1],
    ['goals', { playerNumber: 10, delta: 2 }],
    ['assists', { playerNumber: 10, delta: 1 }],
  ]);
});
