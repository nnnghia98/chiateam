const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiStateRepository } = require('./api-state-repository');

test('API repository loads only requested state', async () => {
  const repository = createApiStateRepository({
    read: async () => ({
      bench: [['1', { name: 'Nghia' }]],
      teamA: [],
      tiensan: 100000,
    }),
    write: async state => state,
  });

  const state = await repository.load(['bench', 'tiensan']);

  assert.deepEqual(state, {
    bench: [['1', { name: 'Nghia' }]],
    tiensan: 100000,
  });
  assert.equal('teamA' in state, false);
});

test('API repository merges changes into the latest storage snapshot', async () => {
  const current = {
    bench: [],
    teamA: [['1', { name: 'Minh' }]],
    tiensan: 100000,
    lastUpdated: 'old-value',
  };
  let written = null;
  let synchronized = null;
  const repository = createApiStateRepository({
    read: async () => current,
    write: async state => {
      written = state;
      return { ...state, lastUpdated: 'new-value' };
    },
    afterSave: async saved => {
      synchronized = saved;
    },
  });

  const saved = await repository.save({
    bench: [['2', { name: 'Nghia' }]],
  });

  assert.deepEqual(written, {
    ...current,
    bench: [['2', { name: 'Nghia' }]],
  });
  assert.equal(saved.lastUpdated, 'new-value');
  assert.deepEqual(synchronized, saved);
});
